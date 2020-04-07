import { stripIndent } from 'common-tags'
import * as fs from 'fs-jetpack'
import prompts from 'prompts'
import { PackageJson } from 'type-fest'
import { Command } from '../../../lib/cli'
import * as Layout from '../../../lib/layout'
import { rootLogger } from '../../../lib/nexus-logger'
import { ownPackage } from '../../../lib/own-package'
import * as PackageManager from '../../../lib/package-manager'
import * as Plugin from '../../../lib/plugin'
import * as proc from '../../../lib/process'
import { createTSConfigContents } from '../../../lib/tsc'
import {
  createGitRepository,
  CWDProjectNameOrGenerate,
} from '../../../lib/utils'

const log = rootLogger.child('cli').child('create').child('app')

const SQLITE_DEFAULT_CONNECTION_URI = 'file:./dev.db'

export default class App implements Command {
  async parse() {
    await run({})
  }
}

interface ConfigInput {
  projectName: string
}

interface InternalConfig {
  projectName: string
}

/**
 * TODO
 */
export async function run(configInput?: Partial<ConfigInput>): Promise<void> {
  if (process.env.NEXUS_CREATE_HANDOFF === 'true') {
    await runLocalHandOff()
  } else {
    await runBootstrapper(configInput)
  }
}

/**
 * TODO
 */
export async function runLocalHandOff(): Promise<void> {
  log.trace('start local handoff')

  const { layout, connectionURI, database } = await loadDataFromParentProcess()
  const plugins = await Plugin.loadInstalledWorktimePlugins(layout)
  log.trace('plugins', { plugins })

  // TODO select a template

  for (const p of plugins) {
    await p.hooks.create.onAfterBaseSetup?.({ database, connectionURI })
  }

  //
  // format project
  //
  await layout.packageManager.runScript('format', { require: true })
}

/**
 * TODO
 */
export async function runBootstrapper(
  configInput?: Partial<ConfigInput>
): Promise<void> {
  log.trace('start bootstrapper')

  log.trace('checking folder is in a clean state')
  await assertIsCleanSlate()

  // For testing
  const databaseTypeEnvVar = (process.env
    .CREATE_APP_CHOICE_DATABASE_TYPE as any)
    ? parseDatabaseChoice(process.env.CREATE_APP_CHOICE_DATABASE_TYPE as any)
    : undefined
  const packageManagerTypeEnvVar = process.env
    .CREATE_APP_CHOICE_PACKAGE_MANAGER_TYPE as any
  const nexusVersionEnvVar = process.env.CREATE_APP_CHOICE_NEXUS_VERSION
  log.trace('create app user choices pre-filled by env vars?', {
    packageManagerTypeEnvVar,
    databaseTypeEnvVar,
    nexusVersionEnvVar,
  })

  const projectName = configInput?.projectName ?? CWDProjectNameOrGenerate()

  const nexusVersion = nexusVersionEnvVar ?? `${ownPackage.version}`

  const packageManagerType =
    packageManagerTypeEnvVar ?? (await askForPackageManager())

  // TODO given the presence of plugin templates it does not make sense anymore
  // for an assumpton about how the layout is going to look
  const layout = Layout.createFromData({
    app: {
      exists: false,
      path: null,
    },
    projectRoot: fs.path(),
    sourceRoot: fs.path('./src'),
    sourceRootRelative: './src',
    schemaModules: ['src/' + Layout.schema.CONVENTIONAL_SCHEMA_FILE_NAME],
    buildOutputRelative: Layout.DEFAULT_BUILD_FOLDER_NAME,
    startModuleOutPath: '', // todo
    startModuleInPath: '', // todo
    project: {
      name: projectName,
      isAnonymous: false,
    },
    packageManagerType: packageManagerType,
    packageJson: {
      // todo
      path: fs.path('package.json'),
      dir: fs.path(),
      content: {},
    },
  })

  const options: InternalConfig = {
    projectName: projectName,
    ...configInput,
  }

  // TODO in the future scan npm registry for nexus plugins, organize by
  // github stars, and so on.
  const askDatabase = databaseTypeEnvVar ?? (await askForDatabase())

  log.info('Scaffolding project')

  await scaffoldBaseFiles(layout, options)

  log.info(`Installing dependencies`, {
    nexusVersion,
  })

  await layout.packageManager.addDeps([`nexus@${nexusVersion}`], {
    require: true,
  })

  //
  // install additional deps
  //

  const devDeps = ['prettier']
  const addDevDepsConfig: PackageManager.AddDepsOptions = {}
  const deps = []
  const addDepsConfig: PackageManager.AddDepsOptions = {}

  if (askDatabase.database) {
    deps.push(`nexus-plugin-prisma@${getPrismaPluginVersion()}`)
    // This allows installing prisma without a warning being emitted about there
    // being a missing prisma schema. For more detail refer to
    // https://prisma-company.slack.com/archives/CEYCG2MCN/p1575480721184700 and
    // https://github.com/prisma/photonjs/blob/master/packages/photon/scripts/generate.js#L67
    addDepsConfig.envAdditions = addDepsConfig.envAdditions ?? {}
    addDepsConfig.envAdditions.SKIP_GENERATE = 'true'

    // Pass chosen database to plugin
    saveDataForChildProcess({
      layout: layout.data,
      database: askDatabase.choice,
      connectionURI: askDatabase.connectionURI,
    })
  } else {
    await helloWorldTemplate(layout)
    saveDataForChildProcess({ layout: layout.data })
  }

  // TODO parallel?
  if (deps.length) {
    await layout.packageManager.addDeps(deps, {
      ...addDepsConfig,
      require: true,
    })
  }

  if (devDeps.length) {
    await layout.packageManager.addDeps(devDeps, {
      ...addDevDepsConfig,
      require: true,
      dev: true,
    })
  }

  //
  // pass off to local create
  //

  await layout.packageManager
    .runBin('nexus create', {
      stdio: 'inherit',
      envAdditions: { NEXUS_CREATE_HANDOFF: 'true' },
      require: true,
    })
    .catch((error) => {
      console.error(error.message)
      process.exit(error.exitCode ?? 1)
    })

  // An exhaustive .gitignore tailored for Node can be found here:
  // https://github.com/github/gitignore/blob/master/Node.gitignore
  // We intentionally stay minimal here, as we want the default ignore file
  // to be as meaningful for nexus users as possible.
  await fs.write(
    '.gitignore',
    stripIndent`
      # Node
      node_modules
      npm-debug.log*
      yarn-debug.log*
      yarn-error.log*
      lerna-debug.log*
    `
  )

  //
  // return to global create
  //

  // Any disk changes after this point will show up as dirty working directory
  // for the user
  await createGitRepository()

  // If the user setup a db driver but not the connection URI yet, then do not
  // enter dev mode yet. Dev mode will result in a runtime-crashing app.
  if (!(askDatabase.database && !askDatabase.connectionURI)) {
    // We will enter dev mode with the local version of nexus. This is a kind
    // of cheat, but what we want users to have as their mental model. When they
    // terminate this dev session, they will restart it typically with e.g. `$
    // yarn dev`. This global-nexus-process-wrapping-local-nexus-process
    // is unique to bootstrapping situations.
    log.info('Starting dev mode')

    await layout.packageManager
      .runScript('dev', {
        stdio: 'inherit',
        envAdditions: { NEXUS_CREATE_HANDOFF: 'true' },
        require: true,
      })
      .catch((error) => {
        console.error(error.message)
        process.exit(error.exitCode ?? 1)
      })
  }
}

// TODO this data should come from db driver
export type Database = 'SQLite' | 'PostgreSQL' | 'MySQL'
type ParsedDatabase =
  | { database: false }
  | { database: true; choice: Database; connectionURI: string | undefined }

/**
 * Ask the user if they would like to use a database driver.
 */
async function askForDatabase(): Promise<ParsedDatabase> {
  let {
    usePrisma,
  }: {
    usePrisma: boolean
  } = await prompts({
    type: 'confirm',
    name: 'usePrisma',
    message: 'Do you want to use a database? (https://prisma.io)',
  })

  if (!usePrisma) {
    return { database: false }
  }
  // TODO the supported databases should come from the plugin driver...
  let { database }: { database: Database } = await prompts({
    type: 'select',
    name: 'database',
    message: 'Choose a database',
    choices: [
      {
        title: 'PostgreSQL',
        description: 'Requires running a PostgreSQL database',
        value: 'PostgreSQL',
      },
      {
        title: 'SQLite',
        description: 'No operational overhead',
        value: 'SQLite',
      },
      {
        title: 'MySQL',
        description: 'Requires running a MySQL database',
        value: 'MySQL',
      },
    ] as any, // Typings are missing the 'description' property...
    initial: 0,
  })

  if (database === 'SQLite') {
    return {
      database: true,
      choice: 'SQLite',
      connectionURI: SQLITE_DEFAULT_CONNECTION_URI,
    }
  }

  // TODO: Removed temporarily until we have a more solid system to validate the uri,
  // and a textbox where we can the cursor... boohoo prompts

  // let { hasURI }: { hasURI: boolean } = await prompts.default({
  //   type: 'confirm',
  //   name: 'hasURI',
  //   message: `Do you have a connection URI to connect to your ${database} database?`,
  // })

  // if (hasURI) {
  //   let { connectionURI }: { connectionURI: string } = await prompts.default({
  //     type: 'text',
  //     message: `Fill in your connection URI for ${database}`,
  //     name: 'connectionURI',
  //   })

  //   return { database: true, choice: database, connectionURI }
  // }

  return { database: true, choice: database, connectionURI: undefined }
}

/**
 * Ask the user if they would like to use npm or yarn.
 * TODO if we detect that yarn is installed on the user's machine then we should
 * default to that, otherwise default to npm.
 */
async function askForPackageManager(): Promise<
  PackageManager.PackageManagerType
> {
  const choices: {
    title: string
    value: PackageManager.PackageManagerType
  }[] = [
    { title: 'npm', value: 'npm' },
    { title: 'yarn', value: 'yarn' },
  ]

  type Result = { packageManagerType: PackageManager.PackageManagerType }

  const result: Result = await prompts({
    name: 'packageManagerType',
    type: 'select',
    message: 'What is your preferred package manager?',
    choices,
  })

  return result.packageManagerType
}

/**
 * Check that the cwd is a suitable place to start a new nexus project.
 */
async function assertIsCleanSlate() {
  const contents = await fs.listAsync()

  if (contents !== undefined && contents.length > 0) {
    proc.fatal(
      'Cannot create a new nexus project here because the directory is not empty:\n %s',
      contents
    )
  }
}

async function helloWorldTemplate(layout: Layout.Layout) {
  await fs.writeAsync(
    layout.sourcePath(Layout.schema.CONVENTIONAL_SCHEMA_FILE_NAME),
    stripIndent`
    import { schema } from "nexus";

    schema.addToContext(req => {
      return {
        memoryDB: {
          worlds: [
            { id: "1", population: 6_000_000, name: "Earth" },
            { id: "2", population: 0, name: "Mars" }
          ]
        }
      }
    })

    schema.objectType({
      name: "World",
      definition(t) {
        t.id("id")
        t.string("name")
        t.float("population")
      }
    })

    schema.queryType({
      definition(t) {        
        t.field("hello", {
          type: "World",
          args: {
            world: schema.stringArg({ required: false })
          },
          resolve(_root, args, ctx) {
            const worldToFindByName = args.world ?? "Earth"
            const world = ctx.memoryDB.worlds.find(w => w.name === worldToFindByName)

            if (!world) throw new Error(\`No such world named "\${args.world}"\`)

            return world
          }
        })

        t.list.field('worlds', {
          type: 'World',
          resolve(_root, _args, ctx) {
            return ctx.memoryDB.worlds
          } 
        })
      }
    })
    `
  )
}

/**
 * Scaffold a new nexus project from scratch
 */
async function scaffoldBaseFiles(
  layout: Layout.Layout,
  options: InternalConfig
) {
  // TODO Template selector?
  // TODO given that we're scaffolding, we know the layout ahead of time. We
  // should take advantage of that, e.g. precompute layout data
  const appEntrypointPath = layout.sourcePath(
    Layout.schema.CONVENTIONAL_SCHEMA_FILE_NAME
  )
  await Promise.all([
    fs.writeAsync('package.json', {
      name: options.projectName,
      license: 'UNLICENSED',
      dependencies: {},
      scripts: {
        format: "npx prettier --write './**/*.{ts,md}' '!./prisma/**/*.md'",
        dev: 'nexus dev',
        build: 'nexus build',
        start: 'node node_modules/.build',
      },
      prettier: {
        semi: false,
        singleQuote: true,
        trailingComma: 'all',
      },
    } as PackageJson),

    fs.writeAsync('tsconfig.json', createTSConfigContents(layout)),

    fs.writeAsync(
      '.vscode/launch.json',
      stripIndent`
        {
          // Note: You can delete this file if you're not using vscode
          "version": "0.2.0",
          "configurations": [
            {
              "type": "node",
              "request": "launch",
              "name": "Debug nexus App",
              "protocol": "inspector",
              "runtimeExecutable": "\${workspaceRoot}/node_modules/.bin/nexus",
              "runtimeArgs": ["dev"],
              "args": ["${layout.projectRelative(appEntrypointPath)}"],
              "sourceMaps": true,
              "console": "integratedTerminal"
            }
          ]
        }    
      `
    ),
  ])
}

const ENV_PARENT_DATA = 'NEXUS_CREATE_DATA'

type SerializableParentData = {
  layout: Layout.Layout['data']
  database?: Plugin.OnAfterBaseSetupLens['database']
  connectionURI?: Plugin.OnAfterBaseSetupLens['connectionURI']
}

type ParentData = Omit<SerializableParentData, 'layout'> & {
  layout: Layout.Layout
}

async function loadDataFromParentProcess(): Promise<ParentData> {
  if (!process.env[ENV_PARENT_DATA]) {
    log.warn(
      'We could not retrieve neccessary data from nexus. Falling back to SQLite database.'
    )

    return {
      layout: await Layout.create({}),
      database: 'SQLite',
      connectionURI: SQLITE_DEFAULT_CONNECTION_URI,
    }
  }

  const deserializedParentData: SerializableParentData = JSON.parse(
    process.env[ENV_PARENT_DATA]!
  )

  return {
    ...deserializedParentData,
    layout: Layout.createFromData(deserializedParentData.layout),
  }
}

function saveDataForChildProcess(data: SerializableParentData): void {
  process.env[ENV_PARENT_DATA] = JSON.stringify(data)
}

/**
 * Helper function for fetching the correct version of prisma plugin to
 * install. Useful for development where we can override the version installed
 * by environment variable NEXUS_PLUGIN_PRISMA_VERSION.
 */
function getPrismaPluginVersion(): string {
  let prismaPluginVersion: string
  if (process.env.NEXUS_PLUGIN_PRISMA_VERSION) {
    log.warn(
      'found NEXUS_PLUGIN_PRISMA_VERSION defined. This is only expected if you are actively developing on nexus right now',
      {
        NEXUS_PLUGIN_PRISMA_VERSION: process.env.NEXUS_PLUGIN_PRISMA_VERSION,
      }
    )
    prismaPluginVersion = process.env.NEXUS_PLUGIN_PRISMA_VERSION
  } else {
    prismaPluginVersion = 'latest'
  }
  return prismaPluginVersion
}

function parseDatabaseChoice(
  database: Database | 'NO_DATABASE'
): ParsedDatabase {
  if (database === 'NO_DATABASE') {
    return { database: false }
  }

  if (database === 'SQLite') {
    return {
      database: true,
      choice: database,
      connectionURI: SQLITE_DEFAULT_CONNECTION_URI,
    }
  }

  return { database: true, choice: database, connectionURI: undefined }
}
