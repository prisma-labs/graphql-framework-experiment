import * as jetpack from 'fs-jetpack'
import * as path from 'path'
import createGit, { SimpleGit } from 'simple-git/promise'
import { createRunner, gitRepo, gitReset } from '../__helpers'

type Workspace = {
  dir: { path: string; pathRelativeToPumpkins: string; cacheHit: boolean }
  run: ReturnType<typeof createRunner>
  fs: ReturnType<typeof jetpack.dir>
  git: SimpleGit
}

async function createWorkspace(): Promise<Workspace> {
  //
  // Setup Dir
  //
  const dir = {} as Workspace['dir']
  const cacheKey = `v4-${
    jetpack.inspect('yarn.lock', {
      checksum: 'md5',
    })!.md5
  }`

  dir.path = `/tmp/pumpkins-integration-test-project-bases/${
    path.parse(__filename).name
  }-${cacheKey}`

  dir.pathRelativeToPumpkins =
    '../' + path.relative(dir.path, path.join(__dirname, '../..'))

  if ((await jetpack.existsAsync(dir.path)) !== false) {
    dir.cacheHit = true
  } else {
    dir.cacheHit = false
    await jetpack.dirAsync(dir.path)
  }

  console.log('cache %s for %s', dir.cacheHit ? 'hit' : 'miss', dir.path)

  //
  // Setup Tools
  //
  const fs = jetpack.dir(dir.path)
  const run = createRunner(dir.path)
  const git = createGit(dir.path)

  //
  // Setup Project (if needed)
  //
  if (!dir.cacheHit) {
    await Promise.all([
      fs.writeAsync('package.json', {
        name: 'test-app',
        license: 'MIT',
        dependencies: {
          pumpkins: ws.dir.pathRelativeToPumpkins,
        },
        scripts: {
          postinstall:
            'yarn -s link pumpkins && chmod +x node_modules/.bin/pumpkins',
        },
      }),
      fs.writeAsync(
        'tsconfig.json',
        `
      {
        "compilerOptions": {
          "target": "es2016",
          "strict": true,
          "outDir": "dist",
          "skipLibCheck": true,
          "allowJs": true,
          "lib": ["esnext"]
        },
      }
    `
      ),
    ])

    run('yarn')
    await gitRepo(git)
  }

  //
  // Return a workspace
  //
  return {
    dir,
    fs,
    run,
    git,
  }
}

const ws = {} as Workspace

beforeAll(async () => {
  Object.assign(ws, await createWorkspace())
})

afterEach(async () => {
  await gitReset(ws.git)
})

it('can build with just a schema module', () => {
  ws.fs.write(
    'schema.ts',
    `
      objectType({
        name: 'A',
        definition(t) {
          t.string('a')
        }
      })
    `
  )

  const result = ws.run('yarn -s pumpkins build')
  expect(result).toMatchSnapshot()
  expect(ws.fs.inspectTree('dist')).toMatchSnapshot()
  // TODO ws.run('node dist/start') ...
})

it('can build with schema + app modules', () => {
  ws.fs.write(
    'schema.ts',
    `
      objectType({
        name: 'A',
        definition(t) {
          t.string('a')
        }
      })
    `
  )

  ws.fs.write('app.ts', `app.server.start()`)

  const result = ws.run('yarn -s pumpkins build')
  expect(result).toMatchSnapshot()
  expect(ws.fs.inspectTree('dist')).toMatchSnapshot()
  // TODO ws.run('node dist/start') ...
})

it('can build a plugin', () => {
  ws.fs.write(
    'myplugin.ts',
    `	
      import { Plugin } from 'pumpkins'	

      export type Context = {	
        a: 1	
      }	
      	
      export default {	
        name: 'myplugin',	
        context: {	
          typeSourcePath: __filename,	
          create() {	
            return {	
              a: 1,	
            }	
          },	
        },	
      } as Plugin<Context>	
    `
  )

  ws.fs.write(
    'schema.ts',
    `queryType({	
        definition(t) {	
          t.int('a', (_root, _args, ctx) => ctx.a)	
          t.field('foo', {	
            type: 'Foo',	
            resolve() {	
              return {	
                bar: 'qux'	
              }	
            }	
          })	
        }	
      })	

      objectType({	
        name: 'Foo',	
        definition(t) {	
          t.string('bar')	
        }	
      })	
    `
  )

  ws.fs.write(
    'app.ts',
    `	
      import myplugin from './myplugin'	
      app.use(myplugin).server.start()	
    `
  )

  const result = ws.run('yarn -s pumpkins build')
  expect(result).toMatchSnapshot()
  expect(ws.fs.inspectTree('dist')).toMatchSnapshot()
  // TODO ws.run('node dist/start') ...
})

it.skip('can build a prisma framework project', () => {
  ws.fs.write(
    'schema.prisma',
    `	
      datasource db {	
        provider = "sqlite"	
        url      = "file:dev.db"	
      }	
      generator photon {	
        provider = "photonjs"	
      }	
      model User {	
        id   Int    @id	
        name String	
      }	
    `
  )

  ws.fs.write(
    'schema.ts',
    `
      objectType({
        name: 'User',
        definition(t) {
          t.model.id()
          t.model.name()
        }
      })
    `
  )

  const result = ws.run('yarn -s pumpkins build')
  expect(result).toMatchSnapshot()
  expect(ws.fs.inspectTree('dist')).toMatchSnapshot()
  // TODO ws.run('node dist/start') ...
})
