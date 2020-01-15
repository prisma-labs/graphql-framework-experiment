import { stripIndent } from 'common-tags'
import * as fs from 'fs-jetpack'
import prompts from 'prompts'
import { PackageJson } from 'type-fest'
import * as Layout from '../../../framework/layout'
import * as Plugin from '../../../framework/plugin'
import {
  createGitRepository,
  createTSConfigContents,
  CWDProjectNameOrGenerate,
  pog,
  logger,
} from '../../../utils'
import * as PackageManager from '../../../utils/package-manager'
import * as proc from '../../../utils/process'
import { Command } from '../../helpers'

const log = pog.sub('cli:create:app')

export default class App implements Command {
  async run() {
    await run()
  }
}

type Options = {
  projectName: string
  graphqlSantaVersion: string
}

/**
 * TODO
 */
export async function run(optionsGiven?: Partial<Options>): Promise<void> {
  if (process.env.GRAPHQL_SANTA_CREATE_HANDOFF === 'true') {
    await runLocalHandOff(optionsGiven)
  } else {
    await runBootstrapper(optionsGiven)
  }
}

/**
 * TODO
 */
export async function runLocalHandOff(
  optionsGiven?: Partial<Options>
): Promise<void> {
  log('start local handoff')

  const { layout, connectionURI, database } = await loadDataFromParentProcess()
  const plugins = await Plugin.loadAllWorkflowPluginsFromPackageJson(layout)
  log('plugins %O', plugins)

  // TODO select a template

  for (const p of plugins) {
    await p.hooks.create.onAfterBaseSetup?.({ database, connectionURI })
  }
}

/**
 * TODO
 */
export async function runBootstrapper(
  optionsGiven?: Partial<Options>
): Promise<void> {
  log('start bootstrapper')

  log('checking folder is in a clean state...')
  await assertIsCleanSlate()

  const packageManagerType = await askForPackageManager()

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
    schemaModules: ['src/schema.ts'],
    buildOutput: Layout.DEFAULT_BUILD_FOLDER_NAME,
    project: {
      name: optionsGiven?.projectName ?? CWDProjectNameOrGenerate(),
      isAnonymous: false,
    },
    packageManagerType,
  })

  // FIXME options given will always be overriden...
  const options: Options = {
    ...optionsGiven,
    projectName: CWDProjectNameOrGenerate(),
    // @ts-ignore
    graphqlSantaVersion: `^${require('../../../../package.json').version}`,
  }

  // TODO in the future scan npm registry for graphql-santa plugins, organize by
  // github stars, and so on.
  const askDatabase = await askForDatabase()

  logger.info('Scaffolding base project files...')
  await scaffoldBaseFiles(layout, options)

  logger.info(
    `Installing graphql-santa@${options.graphqlSantaVersion}... (this will take around ~30 seconds)`
  )
  await layout.packageManager.installDeps({ require: true })

  //
  // install additional deps
  //

  const devDeps = ['prettier', 'pretty-quick', 'husky']
  const addDevDepsConfig: PackageManager.AddDepsOptions = {}
  const deps = []
  const addDepsConfig: PackageManager.AddDepsOptions = {}

  logger.info(
    'Installing additional deps... (this will take around ~30 seconds)'
  )

  if (askDatabase.database) {
    deps.push(`graphql-santa-plugin-prisma@${getPrismaPluginVersion()}`)
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
    .runBin('graphql-santa create', {
      stdio: 'inherit',
      envAdditions: { GRAPHQL_SANTA_CREATE_HANDOFF: 'true' },
      require: true,
    })
    .catch(error => {
      console.error(error.message)
      process.exit(error.exitCode ?? 1)
    })

  // An exhaustive .gitignore tailored for Node can be found here:
  // https://github.com/github/gitignore/blob/master/Node.gitignore
  // We intentionally stay minimal here, as we want the default ignore file
  // to be as meaningful for graphql-santa users as possible.
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

  //
  // format project and setup git
  //

  await layout.packageManager.runScript('format', { require: true })

  // Any disk changes after this point will show up as dirty working directory
  // for the user
  await createGitRepository()

  // If the user setup a db driver but not the connection URI yet, then do not
  // enter dev mode yet. Dev mode will result in a runtime-crashing app.
  if (!(askDatabase.database && !askDatabase.connectionURI)) {
    // We will enter dev mode with the local version of graphql-santa. This is a kind
    // of cheat, but what we want users to have as their mental model. When they
    // terminate this dev session, they will restart it typically with e.g. `$
    // yarn dev`. This global-graphql-santa-process-wrapping-local-graphql-santa-process
    // is unique to bootstrapping situations.
    logger.info('Entering dev mode ...')

    await layout.packageManager
      .runScript('dev', {
        stdio: 'inherit',
        envAdditions: { GRAPHQL_SANTA_CREATE_HANDOFF: 'true' },
        require: true,
      })
      .catch(error => {
        console.error(error.message)
        process.exit(error.exitCode ?? 1)
      })
  }
}

// TODO this data should come from db driver
type Database = 'SQLite' | 'PostgreSQL' | 'MySQL'

/**
 * Ask the user if they would like to use a database driver.
 */
async function askForDatabase(): Promise<
  | { database: false }
  | { database: true; choice: Database; connectionURI: string | undefined }
> {
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
    return { database: true, choice: 'SQLite', connectionURI: 'file://dev.db' }
  }

  // TODO: Removed temporarily until we have a more solid system to validate the uri,
  // and a textbox where we can the cursor... boohoo prompts

  // let { hasURI }: { hasURI: boolean } = await prompts({
  //   type: 'confirm',
  //   name: 'hasURI',
  //   message: `Do you have a connection URI to connect to your ${database} database?`,
  // })

  // if (hasURI) {
  //   let { connectionURI }: { connectionURI: string } = await prompts({
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
    message: 'Please select which package manager you would like to use',
    choices,
  })

  return result.packageManagerType
}

/**
 * Check that the cwd is a suitable place to start a new graphql-santa project.
 */
async function assertIsCleanSlate() {
  const contents = await fs.listAsync()

  if (contents !== undefined && contents.length > 0) {
    proc.fatal(
      'Cannot create a new graphql-santa project here because the directory is not empty:\n %s',
      contents
    )
  }
}

async function helloWorldTemplate(layout: Layout.Layout) {
  await fs.writeAsync(
    layout.sourcePath('schema.ts'),
    stripIndent`
    import { app } from "graphql-santa";

    app.addToContext(req => {
      return {
        db: {
          worlds: [
            { id: "1", population: 6_000_000, name: "Earth" },
            { id: "2", population: 0, name: "Mars" }
          ]
        }
      }
    })

    app.objectType({
      name: "World",
      definition(t) {
        t.id("id")
        t.string("name")
        t.float("population")
      }
    })

    app.queryType({
      definition(t) {        
        t.field("hello", {
          type: "World",
          args: {
            world: app.stringArg({ required: false })
          },
          resolve(_root, args, ctx) {
            const worldToFindByName = args.world || "Earth"
            const world = ctx.db.worlds.find(w => w.name === worldToFindByName)

            if (!world) throw new Error(\`No such world named "\${args.world}"\`)

            return world
          }
        })

        t.list.field('worlds', {
          type: 'World',
          resolve(_root, _args, ctx) {
            return ctx.db.worlds
          } 
        })
      }
    })
    `
  )
}

/**
 * Scaffold a new graphql-santa project from scratch
 */
async function scaffoldBaseFiles(layout: Layout.Layout, options: Options) {
  // TODO Template selector?
  // TODO given that we're scaffolding, we know the layout ahead of time. We
  // should take advantage of that, e.g. precompute layout data
  const appEntrypointPath = layout.sourcePath('schema.ts')
  await Promise.all([
    fs.writeAsync('package.json', {
      name: options.projectName,
      license: 'UNLICENSED',
      dependencies: {
        'graphql-santa': options.graphqlSantaVersion,
      },
      scripts: {
        format: "npx prettier --write './**/*.{ts,md}' '!./prisma/**/*.md'",
        dev: 'santa dev',
        build: 'santa build',
        start: 'node node_modules/.build',
      },
      prettier: {
        semi: false,
        singleQuote: true,
        trailingComma: 'all',
      },
      husky: {
        hooks: {
          'pre-commit': 'pretty-quick --staged',
        },
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
              "name": "Debug graphql-santa App",
              "protocol": "inspector",
              "runtimeExecutable": "\${workspaceRoot}/node_modules/.bin/graphql-santa",
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

const ENV_PARENT_DATA = 'GRAPHQL_SANTA_CREATE_DATA'

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
    logger.warn(
      'We could not retrieve neccessary data from graphql-santa. Falling back to SQLite database.'
    )

    return {
      layout: await Layout.create({}),
      database: 'SQLite',
      connectionURI: 'file://dev.db',
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
 * Helper function for fetching the correct veresion of prisma plugin to
 * install. Useful for development where we can override the version installed
 * by environment variable GRAPHQL_SANTA_PLUGIN_PRISMA_VERSION.
 */
function getPrismaPluginVersion(): string {
  let prismaPluginVersion: string
  if (process.env.GRAPHQL_SANTA_PLUGIN_PRISMA_VERSION) {
    logger.warn(
      'found GRAPHQL_SANTA_PLUGIN_PRISMA_VERSION defined. This is only expected if you are actively developing on graphql-santa right now',
      {
        GRAPHQL_SANTA_PLUGIN_PRISMA_VERSION:
          process.env.GRAPHQL_SANTA_PLUGIN_PRISMA_VERSION,
      }
    )
    prismaPluginVersion = process.env.GRAPHQL_SANTA_PLUGIN_PRISMA_VERSION
  } else {
    prismaPluginVersion = 'latest'
  }
  return prismaPluginVersion
}
