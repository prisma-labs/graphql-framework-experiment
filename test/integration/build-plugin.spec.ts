import { withContext, gitFixture, setupBasePumpkinsProject } from '../__helpers'

const ctx = withContext()
  .use(gitFixture)
  .build()

// TODO integration test showing built app can boot and accept queries

it('can build with plugins', async () => {
  setupBasePumpkinsProject(ctx)

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
      "stdout": "🎃  Generating Nexus artifacts ...
    🎃  Compiling ...
    🎃  Pumpkins server successfully compiled!
    ",
    }
  `)

  expect(ctx.fs.inspectTree('dist')).toMatchInlineSnapshot(`
    Object {
      "children": Array [
        Object {
          "name": "__start.js",
          "size": 355,
          "type": "file",
        },
        Object {
          "name": "app.js",
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
      "size": 1308,
      "type": "dir",
    }
  `)
})
