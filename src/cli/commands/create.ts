import { spawn } from 'child_process'
import { stripIndent } from 'common-tags'
import * as fs from 'fs-jetpack'
import Git from 'simple-git/promise'
import { BUILD_FOLDER_NAME } from '../../constants'
import * as Layout from '../../framework/layout'
import { createTSConfigContents, CWDProjectNameOrGenerate } from '../../utils'
import * as proc from '../../utils/process'
import { Command } from '../helpers'
import { loadPlugins } from '../helpers/utils'

export class Create implements Command {
  async parse() {
    await run()
  }
}

type Options = {
  projectName: string
}

export async function run(optionsGiven?: Partial<Options>): Promise<void> {
  const plugins = await loadPlugins()

  const options: Options = {
    ...optionsGiven,
    projectName: CWDProjectNameOrGenerate(),
  }

  console.log('checking folder is in a clean state...')
  await assertIsCleanSlate()

  console.log('scaffolding project files...')
  const layout = Layout.createFromData({
    app: {
      exists: false,
      path: null,
    },
    projectRoot: fs.path(),
    sourceRoot: fs.path('./app'),
    sourceRootRelative: './app',
    schemaModules: ['app/schema.ts'],
  })
  await scaffoldNewProject(layout, options)

  const socket = {
    log: console.log,
    layout,
  }

  for (const p of plugins) {
    await p.onCreateAfterScaffold?.(socket)
  }

  console.log('installing dependencies... (this will take around ~30 seconds)')
  await proc.run('yarn')

  console.log('running plugins...')

  for (const p of plugins) {
    await p.onCreateAfterDepInstall?.(socket)
  }

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
        hello(world: "Earth") {
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

  const child = spawn('yarn', ['-s', 'dev'], { stdio: 'inherit' })

  const [exitCode, err] = await new Promise<[number | null, Error | null]>(
    resolve => {
      // NOTE "exit" may fire after "error", in which case it will be a noop
      // as per how promises work.

      child.once('error', error => {
        resolve([1, error])
      })

      child.once('exit', (exitCode, signal) => {
        resolve([exitCode ?? 0, null])
      })
    }
  )

  // TODO integrate this concept into the cli runner proper. E.g. maybe be
  // able to return { code, err }
  if (err) console.error(err.message)
  if (exitCode) process.exit(exitCode)
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

/**
 * Scaffold a new pumpkins project from scratch
 */
async function scaffoldNewProject(layout: Layout.Layout, options: Options) {
  // TODO eventually `master` should become `latest`
  // TODO Template selector?
  // TODO given that we're scaffolding, we know the layout ahead of time. We
  // should take advantage of that, e.g. precompute layout data
  const appEntrypointPath = layout.sourcePath('schema.ts')
  await Promise.all([
    fs.writeAsync('package.json', {
      name: options.projectName,
      license: 'UNLICENSED',
      dependencies: {
        pumpkins: 'master',
      },
      scripts: {
        dev: 'pumpkins dev',
        build: 'pumpkins build',
        start: 'node node_modules/.build',
      },
    }),

    fs.writeAsync(
      'tsconfig.json',
      createTSConfigContents(layout, BUILD_FOLDER_NAME)
    ),

    fs.writeAsync(
      appEntrypointPath,
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
              "name": "Debug Pumpkins Server",
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
