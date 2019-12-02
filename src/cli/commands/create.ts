import * as fs from 'fs-jetpack'
import { Command } from '../helpers'
import { fatal, run } from '../../utils/process'
import { stripIndent, stripIndents } from 'common-tags'

export class Create implements Command {
  async parse() {
    console.log('checking folder is in a clean state...')
    await assertIsCleanSlate()

    console.log('scaffolding project files...')
    await scaffoldNewProject()

    console.log(
      'installing dependencies... (this will take around ~30 seconds)'
    )
    await run('yarn')

    console.log('initializing development database...')
    await run('yarn -s prisma2 lift save --create-db --name init')
    await run('yarn -s prisma2 lift up')

    console.log('seeding data...')
    await run('yarn -s ts-node prisma/seed')

    console.log(stripIndent`
      all done now please run:

          yarn dev
          
      then try this query out:

          query {
            hello {
              population
            }
          }
    `)
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
async function scaffoldNewProject() {
  // TODO given that we're scaffolding, we know the layout ahead of time. We
  // TODO generate code name for pumpkins app
  // should take advantage of that, e.g. precompute layout data
  // write a package.json
  // write a tsconfig
  // write a prisma config
  // write an app.ts
  await Promise.all([
    fs.writeAsync('package.json', {
      name: 'my-app',
      license: 'UNLICENSED',
      dependencies: { pumpkins: 'master' },
      scripts: {
        dev: 'pumpkins dev',
        build: 'pumpkins build',
        start: 'node node_modules/.build/start',
      },
    }),

    fs.writeAsync('tsconfig.json', '{}'),

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
          population Int
        }
      `
    ),

    fs.writeAsync(
      'prisma/seed.ts',
      stripIndent`
        import { Photon } from "@prisma/photon"

        const photon = new Photon()
        
        photon.worlds.create({
          data: {
            name: "Earth",
            population: 6_000_000_000
          }
        })
    `
    ),

    fs.writeAsync(
      'app/schema.ts',
      stripIndent`
        import { app } from "pumpkins"

        app.objectType({
          name: "World",
          definition(t) {
            t.float("population")
          }
        })
        
        app.queryType({
          definition(t) {
            t.field("hello", {
              type: "World",
              resolve(_root, _args, ctx) {
                return ctx.photon.worlds.findOne({ name: 'earth' })
              }
            })
          }
        })
      `
    ),
  ])
}
