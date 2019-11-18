import { withContext, gitFixture } from '../__helpers'

const ctx = withContext()
  .use(gitFixture)
  .build()

// TODO integration test showing built app can boot and accept queries

it('can build with minimal server + schema + prisma + plugin', async () => {
  ctx.fs.write(
    'package.json',
    `
      {
        "name": "test-app",
        "dependencies": {
          "pumpkins": "${ctx.pathAbsoluteToProject}"
        },
        "license": "MIT"
      }
    `
  )

  ctx.run('yarn')

  // HACK to work around oclif failing on import error
  ctx.run('rm -rf node_modules/pumpkins/src')

  ctx.run('touch dev.db')

  ctx.fs.write(
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

  ctx.fs.write(
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

  ctx.fs.write(
    'tsconfig.json',
    `
      {
        "compilerOptions": {
          "target": "es2016",
          "strict": true,
          "outDir": "dist",
          "lib": ["esnext"]
        },
      }
    `
  )

  ctx.fs.write(
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

  ctx.fs.write(
    'app.ts',
    `
      import myplugin from './myplugin'

      app.use(myplugin).server.start()
    `
  )

  expect(ctx.run('yarn -s pumpkins build')).toMatchInlineSnapshot(`
    Object {
      "status": 0,
      "stderr": "",
      "stdout": "🎃  Running Prisma generators ...
    🎃  Generating Nexus artifacts ...
    🎃  Compiling ...
    🎃  Pumpkins server successfully compiled!
    ",
    }
  `)

  expect(ctx.fs.inspectTree('dist')).toMatchInlineSnapshot(`
    Object {
      "children": Array [
        Object {
          "name": "app.js",
          "size": 270,
          "type": "file",
        },
        Object {
          "name": "app__original__.js",
          "size": 319,
          "type": "file",
        },
        Object {
          "name": "myplugin.js",
          "size": 268,
          "type": "file",
        },
        Object {
          "name": "schema.js",
          "size": 366,
          "type": "file",
        },
      ],
      "name": "dist",
      "size": 1223,
      "type": "dir",
    }
  `)
})
