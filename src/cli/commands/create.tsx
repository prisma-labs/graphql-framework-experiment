import React from 'react'
import { stripIndent } from 'common-tags'
import * as fs from 'fs-jetpack'
import Git from 'simple-git/promise'
import * as Layout from '../../framework/layout'
import {
  createTSConfigContents,
  CWDProjectNameOrGenerate,
  pog,
} from '../../utils'
import * as proc from '../../utils/process'
import { Command } from '../helpers'
import * as Plugin from '../../framework/plugin'
import { render, AppContext } from 'ink'
import SelectInput from 'ink-select-input'

const log = pog.sub('cli:create')

export class Create implements Command {
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

  const layout = await Layout.loadDataFromParentProcess()
  const plugins = await Plugin.loadAllWorkflowPluginsFromPackageJson(layout)
  log('plugins %O', plugins)

  // TODO select a template

  for (const p of plugins) {
    await p.create.onAfterBaseSetup?.()
  }
}

/**
 * TODO
 */
export async function runBootstrapper(
  optionsGiven?: Partial<Options>
): Promise<void> {
  log('start bootstrapper')

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
  })
  Object.assign(process.env, Layout.saveDataForChildProcess(layout))

  const options: Options = {
    ...optionsGiven,
    projectName: CWDProjectNameOrGenerate(),
    pumpkinsVersion: `^${require('../../../package.json').version}`,
  }

  console.log('checking folder is in a clean state...')
  await assertIsCleanSlate()

  console.log('scaffolding base project files...')
  await scaffoldBaseFiles(layout, options)

  console.log('Would you like to use Prisma? (https://prisma.io)')
  // TODO in the future scan npm registry for pumpkins plugins, organize by
  // github stars, and so on.
  let usePrisma = true
  await render(
    <AppContext.Consumer>
      {({ exit }) => (
        <SelectInput
          items={[
            { label: 'yes', value: 'true' },
            { label: 'no', value: 'false' },
          ]}
          onSelect={item => {
            usePrisma = item.value === 'true'
            exit()
          }}
        ></SelectInput>
      )}
    </AppContext.Consumer>
  ).waitUntilExit()

  console.log(
    `installing pumpkins@${options.pumpkinsVersion}... (this will take around ~20 seconds)`
  )
  await proc.run('yarn', { require: true })

  if (usePrisma) {
    console.log(
      'installing prisma plugin... (this will take around ~10 seconds)'
    )
    // TODO @latest
    await proc.run('yarn add pumpkins-plugin-prisma@master', {
      // await proc.run('yarn add pumpkins-plugin-prisma@master', {
      // This allows installing prisma without a warning being emitted about there
      // being a missing prisma schema. For more detail refer to
      // https://prisma-company.slack.com/archives/CEYCG2MCN/p1575480721184700 and
      // https://github.com/prisma/photonjs/blob/master/packages/photon/scripts/generate.js#L67
      envAdditions: {
        SKIP_GENERATE: 'true',
      },
      require: true,
    })
  }

  console.log('select a template to continue with...')
  await proc
    .run('yarn -s pumpkins create', {
      stdio: 'inherit',
      envAdditions: { PUMPKINS_CREATE_HANDOFF: 'true' },
      require: true,
    })
    .catch(error => {
      console.error(error.message)
      process.exit(error.exitCode ?? 1)
    })

  console.log('initializing git repo...')
  const git = Git()

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
  await git.init()
  await git.raw(['add', '-A'])
  await git.raw(['commit', '-m', 'initial commit'])

  console.log(stripIndent`
    entering dev mode...
        
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

  await proc
    .run('yarn -s dev', {
      stdio: 'inherit',
      envAdditions: { PUMPKINS_CREATE_HANDOFF: 'true' },
      require: true,
    })
    .catch(error => {
      console.error(error.message)
      process.exit(error.exitCode ?? 1)
    })
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
      import { app } from "pumpkins"

      app.objectType({
        name: "World",
        definition(t) {
          t.id('id')
          t.string('name')
          t.float('population')
        }
      })

      app.queryType({
        definition(t) {
          t.field("hello", {
            type: "World",
            args: {
              world: app.stringArg({ required: false })
            },
            async resolve(_root, args, ctx) {
              const worldToFindByName = args.world ?? 'Earth'
              const world = {
                Earth: { id: '1', population: 6_000_000, name: 'Earth' },
                Mars: { id: '2', population: 0, name: 'Mars' },
              }[worldToFindByName]

              if (!world) throw new Error(\`No such world named "\${args.world}"\`)

              return world
            }
          })
        }
      })
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
    }),

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
