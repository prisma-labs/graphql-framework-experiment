import { stripIndent } from 'common-tags'
import * as fs from 'fs-jetpack'
import * as Path from 'path'
import prompts from 'prompts'
import { PackageJson } from 'type-fest'
import { Command } from '../../../lib/cli'
import { rightOrFatal } from '../../../lib/utils'
import * as Layout from '../../../lib/layout'
import { tsconfigTemplate } from '../../../lib/layout/tsconfig'
import { rootLogger } from '../../../lib/nexus-logger'
import { ownPackage } from '../../../lib/own-package'
import * as PackageManager from '../../../lib/package-manager'
import * as PluginRuntime from '../../../lib/plugin'
import * as PluginWorktime from '../../../lib/plugin/worktime'
import * as proc from '../../../lib/process'
import { createGitRepository, CWDProjectNameOrGenerate } from '../../../lib/utils'

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
  projectRoot: string
  sourceRoot: string
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

  const parentData = await loadDataFromParentProcess()
  const layout = rightOrFatal(await Layout.create())
  const pluginM = await PluginWorktime.getUsedPlugins(layout)
  const plugins = PluginRuntime.importAndLoadWorktimePlugins(pluginM, layout)
  log.trace('plugins', { plugins })

  // TODO select a template

  for (const p of plugins) {
    await p.hooks.create.onAfterBaseSetup?.({
      database: parentData.database,
      connectionURI: parentData.connectionURI,
    })
  }
}

/**
 * TODO
 */
export async function runBootstrapper(configInput?: Partial<ConfigInput>): Promise<void> {
  log.trace('start bootstrapper')

  await assertIsCleanSlate()

  const projectName = configInput?.projectName ?? CWDProjectNameOrGenerate()
  const internalConfig: InternalConfig = {
    projectName: projectName,
    projectRoot: process.cwd(),
    sourceRoot: Path.join(process.cwd(), 'api'),
    ...configInput,
  }
  const nexusVersion = getNexusVersion()
  const packageManager = await getPackageManager(internalConfig.projectRoot)

  if (packageManager === 'sigtermed') {
    return
  }

  const database = await getDatabaseSelection()

  if (database === 'sigtermed') {
    return
  }

  // TODO in the future scan npm registry for nexus plugins, organize by
  // github stars, and so on.

  log.info('Scaffolding project')

  await scaffoldBaseFiles(internalConfig)

  log.info(`Installing dependencies`, {
    nexusVersion,
  })

  await packageManager.addDeps([`nexus@${nexusVersion}`], {
    require: true,
  })

  //
  // install additional deps
  //

  const deps = []
  const addDepsConfig: PackageManager.AddDepsOptions = {
    envAdditions: {},
  }

  // [1]
  // This allows installing prisma without a warning being emitted about there
  // being a missing prisma schema. For more detail refer to
  // https://prisma-company.slack.com/archives/CEYCG2MCN/p1575480721184700 and
  // https://github.com/prisma/photonjs/blob/master/packages/photon/scripts/generate.js#L67

  if (database) {
    deps.push(`nexus-plugin-prisma@${getPrismaPluginVersion()}`)
    addDepsConfig.envAdditions!.SKIP_GENERATE = 'true' // 1
    saveDataForChildProcess({
      database: database.choice,
      connectionURI: database.connectionURI,
    })
    // Allow the plugin to be enabled so that nexus can run the `onAfterBaseSetup` hook
    await scaffoldTemplate(templates.prisma(internalConfig))
  } else {
    await scaffoldTemplate(templates.helloWorld(internalConfig))
  }

  if (deps.length) {
    await packageManager.addDeps(deps, {
      ...addDepsConfig,
      require: true,
    })
  }

  await packageManager.addDeps(['prettier'], {
    require: true,
    dev: true,
  })

  //
  // pass off to local create
  //

  await packageManager
    .runBin('nexus create', {
      stdio: 'inherit',
      envAdditions: { NEXUS_CREATE_HANDOFF: 'true' },
      require: true,
    })
    .catch((error) => {
      console.error(error.message)
      process.exit(error.exitCode ?? 1)
    })

  //
  // return to global create
  //

  // Any disk changes after this point will show up as dirty working directory
  // for the user
  await createGitRepository()

  // If the user setup a db driver but not the connection URI yet, then do not
  // enter dev mode yet. Dev mode will result in a runtime-crashing app.
  if (!(database && !database.connectionURI)) {
    // We will enter dev mode with the local version of nexus. This is a kind
    // of cheat, but what we want users to have as their mental model. When they
    // terminate this dev session, they will restart it typically with e.g. `$
    // yarn dev`. This global-nexus-process-wrapping-local-nexus-process
    // is unique to bootstrapping situations.
    log.info('Starting dev mode')

    await packageManager
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

async function getPackageManager(projectRoot: string): Promise<PackageManager.PackageManager | 'sigtermed'> {
  const packageManagerTypeEnvVar = process.env.CREATE_APP_CHOICE_PACKAGE_MANAGER_TYPE as
    | PackageManager.PackageManagerType
    | undefined

  const packageManagerType = packageManagerTypeEnvVar ?? (await askForPackageManager())

  if (packageManagerType === 'sigtermed') {
    return 'sigtermed'
  }

  const packageManager = PackageManager.createPackageManager(packageManagerType, { projectRoot })

  return packageManager
}

function getNexusVersion(): string {
  const nexusVersionEnvVar = process.env.CREATE_APP_CHOICE_NEXUS_VERSION
  const nexusVersion = nexusVersionEnvVar ?? `${ownPackage.version}`
  return nexusVersion
}

async function getDatabaseSelection(): Promise<DatabaseSelection | 'sigtermed'> {
  const envar = process.env.CREATE_APP_CHOICE_DATABASE_TYPE as Database | 'NO_DATABASE' | undefined

  if (envar) {
    if (envar === 'NO_DATABASE') {
      return null
    }
    if (envar === 'SQLite') {
      return {
        database: true,
        choice: envar,
        connectionURI: SQLITE_DEFAULT_CONNECTION_URI,
      }
    }
    return {
      database: true,
      choice: envar,
      connectionURI: undefined,
    }
  }

  return await askForDatabase()
}

// TODO this data should come from db driver

export type Database = 'SQLite' | 'PostgreSQL' | 'MySQL'

type DatabaseSelection =
  | null
  | 'sigtermed'
  | {
      database: true
      choice: Database
      connectionURI: string | undefined
    }

/**
 * Ask the user if they would like to use a database driver.
 */
async function askForDatabase(): Promise<DatabaseSelection> {
  let {
    usePrisma,
  }: {
    usePrisma?: boolean
  } = await prompts({
    type: 'confirm',
    name: 'usePrisma',
    message: 'Do you want to use a database? (https://prisma.io)',
  })

  if (usePrisma === undefined) {
    return 'sigtermed'
  }

  if (usePrisma === false) {
    return null
  }
  // TODO the supported databases should come from the plugin driver...
  let { database }: { database?: Database } = await prompts({
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

  if (database === undefined) {
    return 'sigtermed'
  }

  if (database === 'SQLite') {
    return {
      database: true,
      choice: 'SQLite',
      connectionURI: SQLITE_DEFAULT_CONNECTION_URI,
    }
  }

  return { database: true, choice: database, connectionURI: undefined }
}

/**
 * Ask the user if they would like to use npm or yarn.
 * TODO if we detect that yarn is installed on the user's machine then we should
 * default to that, otherwise default to npm.
 */
async function askForPackageManager(): Promise<PackageManager.PackageManagerType | 'sigtermed'> {
  const choices: {
    title: string
    value: PackageManager.PackageManagerType
  }[] = [
    { title: 'yarn', value: 'yarn' },
    { title: 'npm', value: 'npm' },
  ]

  type Result = {
    packageManagerType?: PackageManager.PackageManagerType
  }

  const result: Result = await prompts({
    name: 'packageManagerType',
    type: 'select',
    message: 'What is your preferred package manager?',
    choices,
  })

  if (result.packageManagerType === undefined) {
    return 'sigtermed'
  }

  return result.packageManagerType
}

/**
 * Check that the cwd is a suitable place to start a new nexus project.
 */
async function assertIsCleanSlate() {
  log.trace('checking folder is in a clean state')
  const contents = await fs.listAsync()

  if (contents !== undefined && contents.length > 0) {
    proc.fatal('Cannot create a new nexus project here because the directory is not empty', {
      contents,
    })
  }
}

async function scaffoldTemplate(template: Template) {
  return Promise.all(
    template.files.map(({ path, content }) => {
      return fs.writeAsync(path, content)
    })
  )
}

interface TemplateCreator {
  (internalConfig: InternalConfig): Template
}

interface Template {
  files: { path: string; content: string }[]
}

type TemplateName = 'helloWorld' | 'prisma'

const templates: Record<TemplateName, TemplateCreator> = {
  helloWorld(internalConfig) {
    return {
      files: [
        {
          path: Path.join(internalConfig.sourceRoot, 'graphql.ts'),
          content: stripIndent`
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
          `,
        },
      ],
    }
  },
  prisma(internalConfig) {
    return {
      files: [
        {
          path: Path.join(internalConfig.sourceRoot, 'app.ts'),
          content: stripIndent`
          import { use } from 'nexus'
          import { prisma } from 'nexus-plugin-prisma'
          
          use(prisma())
        `,
        },
      ],
    }
  },
}

/**
 * Scaffold a new nexus project from scratch
 */
async function scaffoldBaseFiles(options: InternalConfig) {
  const appEntrypointPath = Path.join(options.sourceRoot, 'app.ts')
  const sourceRootRelative = Path.relative(options.projectRoot, options.sourceRoot)

  await Promise.all([
    // Empty app and graphql module.
    // Having at least one of these satisfies minimum Nexus requirements.
    // We put both to setup vscode debugger config with an entrypoint that is
    // unlikely to change.
    fs.writeAsync(
      appEntrypointPath,
      stripIndent`
      /**
       * This file is your server entrypoint. Don't worry about its emptyness, Nexus handles everything for you.
       * However, if you need to add settings, enable plugins, schema middleware etc, this is place to do it.
       * Below are some examples of what you can do. Uncomment them to try them out!
       */

      /**
       * Change a variety of settings
       */

      // import { settings } from 'nexus'
      //
      // settings.change({
      //   server: {
      //     port: 4001
      //   }
      // })

      /**
       * Add some schema middleware
       */

      // import { schema } from 'nexus'
      //
      // schema.middleware((_config) => {
      //   return async (root, args, ctx, info, next) {
      //     ctx.log.trace('before resolver')
      //     await next(root, args, ctx, info)
      //     ctx.log.trace('after resolver')
      //   }
      // })

      /**
       * Enable the Prisma plugin. (Needs \`nexus-plugin-prisma\` installed)
       */

      // import { use } from 'nexus'
      // import { prisma } from 'nexus-plugin-prisma'
      //
      // use(prisma())
    `
    ),
    fs.writeAsync(Path.join(options.sourceRoot, 'graphql.ts'), ''),
    // An exhaustive .gitignore tailored for Node can be found here:
    // https://github.com/github/gitignore/blob/master/Node.gitignore
    // We intentionally stay minimal here, as we want the default ignore file
    // to be as meaningful for nexus users as possible.
    fs.writeAsync(
      '.gitignore',
      stripIndent`
        # Node
        node_modules
        npm-debug.log*
        yarn-debug.log*
        yarn-error.log*
        lerna-debug.log*
      `
    ),
    fs.writeAsync(Path.join(options.projectRoot, 'package.json'), {
      name: options.projectName,
      license: 'UNLICENSED',
      version: '0.0.0',
      dependencies: {},
      scripts: {
        format: "npx prettier --write './**/*.{ts,md}'",
        dev: 'nexus dev',
        build: 'nexus build',
        start: `node .nexus/build/${sourceRootRelative}`,
      },
      prettier: {
        semi: false,
        singleQuote: true,
        trailingComma: 'all',
      },
    } as PackageJson),

    // todo should be supplied by the plugins
    fs.writeAsync('.prettierignore', './prisma/**/*.md'),

    fs.writeAsync(
      'tsconfig.json',
      tsconfigTemplate({
        sourceRootRelative,
        outRootRelative: Layout.DEFAULT_BUILD_DIR_PATH_RELATIVE_TO_PROJECT_ROOT,
      })
    ),

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
              "name": "Debug Nexus App",
              "protocol": "inspector",
              "runtimeExecutable": "\${workspaceRoot}/node_modules/.bin/nexus",
              "runtimeArgs": ["dev"],
              "args": ["${Path.relative(options.projectRoot, appEntrypointPath)}"],
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

type ParentData = {
  database?: PluginRuntime.OnAfterBaseSetupLens['database']
  connectionURI?: PluginRuntime.OnAfterBaseSetupLens['connectionURI']
}

async function loadDataFromParentProcess(): Promise<ParentData> {
  if (process.env[ENV_PARENT_DATA]) {
    const data = JSON.parse(process.env[ENV_PARENT_DATA]!)
    log.trace('loaded parent data', { data })
    return data
  }
  log.trace('no parent data found to load')
  return {}
}

function saveDataForChildProcess(data: ParentData): void {
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
