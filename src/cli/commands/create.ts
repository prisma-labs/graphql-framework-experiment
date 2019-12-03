import * as fs from 'fs-jetpack'
import { Command } from '../helpers'
import { fatal, run } from '../../utils/process'
import { stripIndent } from 'common-tags'
import Git from 'simple-git/promise'
import * as Layout from '../../framework/layout'
import { createTSConfigContents } from '../../utils'
import { spawn } from 'child_process'

export class Create implements Command {
  async parse() {
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
    })
    await scaffoldNewProject(layout)

    console.log(
      'installing dependencies... (this will take around ~30 seconds)'
    )
    await run('yarn')

    console.log('initializing development database...')
    await run('yarn -s prisma2 lift save --create-db --name init')
    await run('yarn -s prisma2 lift up')

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

        # TypeScript
        *.tsbuildinfo
      `
    )
    await git.init()
    await git.raw(['add', '-A'])
    await git.raw(['commit', '-m', 'initial commit'])

    console.log('seeding data...')
    await run('yarn -s ts-node prisma/seed')

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
          console.log('er')
          resolve([1, error])
        })

        child.once('exit', (exitCode, signal) => {
          console.log('%s %s', exitCode, signal)
          resolve([exitCode ?? 0, null])
        })
      }
    )

    // TODO integrate this concept into the cli runner proper. E.g. maybe be
    // able to return { code, err }
    if (err) console.error(err.message)
    if (exitCode) process.exit(exitCode)
  }
}

/**
 * Check that the cwd is a suitable place to start a new pumpkins project.
 */
async function assertIsCleanSlate() {
  const contents = await fs.listAsync()

  if (contents !== undefined && contents.length > 0) {
    fatal(
      'Cannot create a new pumpkins project here because the directory is not empty:\n %s',
      contents
    )
  }
}

/**
 * Scaffold a new pumpkins project from scratch
 */
async function scaffoldNewProject(layout: Layout.Layout) {
  // TODO eventually `master` should become `latest`
  // TODO blog example? Template selector?
  // TODO generate code name for pumpkins app?
  // TODO given that we're scaffolding, we know the layout ahead of time. We
  // should take advantage of that, e.g. precompute layout data
  await Promise.all([
    fs.writeAsync('package.json', {
      name: 'my-app',
      license: 'UNLICENSED',
      dependencies: {
        pumpkins: 'master',
      },
      scripts: {
        dev: 'pumpkins dev',
        build: 'pumpkins build',
        start: 'node node_modules/.build/start',
      },
    }),

    fs.writeAsync('tsconfig.json', createTSConfigContents(layout)),

    fs.writeAsync(
      'prisma/schema.prisma',
      stripIndent`
        datasource db {
          provider = "sqlite"
          url      = "file:dev.db"
        }

        generator photon {
          provider = "photonjs"
        }

        model World {
          id         Int     @id
          name       String  @unique
          population Float
        }
      `
    ),

    fs.writeAsync(
      'prisma/seed.ts',
      stripIndent`
        import { Photon } from "@prisma/photon"

        const photon = new Photon()
        
        main()
        
        async function main() {
          const result = await photon.worlds.create({
            data: {
              name: "Earth",
              population: 6_000_000_000
            }
          })
        
          console.log("Seeded: %j", result)
        
          photon.disconnect()
        }
      `
    ),

    fs.writeAsync(
      layout.sourcePath('schema.ts'),
      stripIndent`
        import { app } from "pumpkins"

        app.objectType({
          name: "World",
          definition(t) {
            t.model.id()
            t.model.name()
            t.model.population()
          }
        })
        
        app.queryType({
          definition(t) {
            t.field("hello", {
              type: "World",
              resolve(_root, _args, ctx) {
                return ctx.photon.worlds.findOne({
                  where: {
                    name: "Earth"
                  }
                })
              }
            })
          }
        })
      `
    ),
  ])
}
