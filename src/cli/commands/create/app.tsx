import chalk from 'chalk'
import { stripIndent } from 'common-tags'
import * as fs from 'fs-jetpack'
import prompts from 'prompts'
import { PackageJson } from 'type-fest'
import * as Layout from '../../../framework/layout'
import * as Plugin from '../../../framework/plugin'
import {
  createTSConfigContents,
  CWDProjectNameOrGenerate,
  pog,
  createGitRepository,
} from '../../../utils'
import { logger } from '../../../utils/logger'
import * as proc from '../../../utils/process'
import { Command } from '../../helpers'
import * as PackageManager from '../../../utils/package-manager'

const log = pog.sub('cli:create:app')

export default class App implements Command {
  async parse() {
    await run()
  }
}

type Options = {
  projectName: string
  pumpkinsVersion: string
}

/**
 * TODO
 */
export async function run(optionsGiven?: Partial<Options>): Promise<void> {
  if (process.env.PUMPKINS_CREATE_HANDOFF === 'true') {
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
    await p.create.onAfterBaseSetup?.({ database, connectionURI })
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
    sourceRoot: fs.path('./app'),
    sourceRootRelative: './app',
    schemaModules: ['app/schema.ts'],
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
    pumpkinsVersion: require('../../../../package.json').version,
  }

  // TODO in the future scan npm registry for pumpkins plugins, organize by
  // github stars, and so on.
  const askDatabase = await askForDatabase()

  logger.successBold('Scaffolding base project files...')
  await scaffoldBaseFiles(layout, options)

  logger.successBold(
    `Installing pumpkins@${options.pumpkinsVersion}... (this will take around ~20 seconds)`
  )
  await layout.packageManager.installDeps({ require: true })

  /**
   * First class support for Prisma
   */
  if (askDatabase.database) {
    logger.successBold(
      'Installing Prisma plugin... (this will take around ~10 seconds)'
    )
    // Env var used for development
    const prismaPluginVersion =
      process.env.PUMPKINS_PLUGIN_PRISMA_VERSION ?? 'master'
    // TODO @latest
    await layout.packageManager.addDeps(
      [`pumpkins-plugin-prisma@${prismaPluginVersion}`],
      {
        // await proc.run('yarn add pumpkins-plugin-prisma@master', {
        // This allows installing prisma without a warning being emitted about there
        // being a missing prisma schema. For more detail refer to
        // https://prisma-company.slack.com/archives/CEYCG2MCN/p1575480721184700 and
        // https://github.com/prisma/photonjs/blob/master/packages/photon/scripts/generate.js#L67
        envAdditions: {
          SKIP_GENERATE: 'true',
        },
        require: true,
      }
    )

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

  await layout.packageManager
    .run('pumpkins create', {
      stdio: 'inherit',
      envAdditions: { PUMPKINS_CREATE_HANDOFF: 'true' },
      require: true,
    })
    .catch(error => {
      console.error(error.message)
      process.exit(error.exitCode ?? 1)
    })

  // An exhaustive .gitignore tailored for Node can be found here:
  // https://github.com/github/gitignore/blob/master/Node.gitignore
  // We intentionally stay minimal here, as we want the default ignore file
  // to be as meaningful for pumpkins users as possible.
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

  await createGitRepository()

  if (askDatabase.database && askDatabase.connectionURI) {
    logger.success(stripIndent`
    ${chalk.bold('Entering dev mode...')}
        
    Try this query to get started: 

      query {
        hello {
          name
          population
        }
      }
  `)
    console.log() // force a newline to give code block breathing room, stripped by template tag above

    // We will enter dev mode with the local version of pumpkins. This is a kind
    // of cheat, but what we want users to have as their mental model. When they
    // terminate this dev session, they will restart it typically with e.g. `$
    // yarn dev`. This global-pumpkins-process-wrapping-local-pumpkins-process
    // is unique to bootstrapping situations.

    await layout.packageManager
      .run('dev', {
        stdio: 'inherit',
        envAdditions: { PUMPKINS_CREATE_HANDOFF: 'true' },
        require: true,
      })
      .catch(error => {
        console.error(error.message)
        process.exit(error.exitCode ?? 1)
      })
  }
}

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
  let { database }: { database: Database } = await prompts({
    type: 'select',
    name: 'database',
    message: 'Choose a database',
    choices: [
      {
        title: 'SQLite',
        description: 'Easiest to set up',
        value: 'SQLite',
      },
      {
        title: 'MySQL',
        description: 'Requires running a MySQL database',
        value: 'MySQL',
      },
      {
        title: 'PostgreSQL',
        description: 'Requires running a PostgreSQL database',
        value: 'PostgreSQL',
      },
    ] as any, // Typings are missing the 'description' property...
    initial: 0,
  })

  if (database === 'SQLite') {
    return { database: true, choice: 'SQLite', connectionURI: 'file://dev.db' }
  }

  let { hasURI }: { hasURI: boolean } = await prompts({
    type: 'confirm',
    name: 'hasURI',
    message: `Do you have a connection URI to connect to your ${database} database?`,
  })

  if (hasURI) {
    let { connectionURI }: { connectionURI: string } = await prompts({
      type: 'text',
      message: `Fill in your connection URI for ${database}`,
      name: 'connectionURI',
    })

    return { database: true, choice: database, connectionURI }
  }

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
 * Check that the cwd is a suitable place to start a new pumpkins project.
 */
async function assertIsCleanSlate() {
  const contents = await fs.listAsync()

  if (contents !== undefined && contents.length > 0) {
    proc.fatal(
      'Cannot create a new pumpkins project here because the directory is not empty:\n %s',
      contents
    )
  }
}

async function helloWorldTemplate(layout: Layout.Layout) {
  await fs.writeAsync(
    layout.sourcePath('schema.ts'),
    stripIndent`
    import { app } from "pumpkins";

    app.objectType({
      name: "World",
      definition(t) {
        t.id("id");
        t.string("name");
        t.float("population");
      }
    });

    app.queryType({
      definition(t) {
        t.field("hello", {
          type: "World",
          args: {
            world: app.stringArg({ required: false })
          },
          async resolve(_root, args, ctx) {
            const worldToFindByName = args.world || "Earth";
            const worlds = [
              { id: "1", population: 6_000_000, name: "Earth" },
              { id: "2", population: 0, name: "Mars" }
            ];
            const world = worlds.find(w => w.name === worldToFindByName);

            if (!world) throw new Error(\`No such world named "\${args.world}"\`);

            return world;
          }
        });
      }
    });
    `
  )
}

/**
 * Scaffold a new pumpkins project from scratch
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
        pumpkins: options.pumpkinsVersion,
      },
      scripts: {
        dev: 'pumpkins dev',
        build: 'pumpkins build',
        start: 'node node_modules/.build',
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
              "name": "Debug Pumpkins App",
              "protocol": "inspector",
              "runtimeExecutable": "\${workspaceRoot}/node_modules/.bin/pumpkins",
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

const ENV_PARENT_DATA = 'PUMPKINS_CREATE_DATA'

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
      'We could not retrieve neccessary data from pumpkins. Falling back to SQLite database.'
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
