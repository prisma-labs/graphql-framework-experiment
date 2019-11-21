import { withContext, gitFixture, setupBasePumpkinsProject } from '../__helpers'

const ctx = withContext()
  .use(gitFixture)
  .build()

// TODO integration test showing built app can start and accept queries

it('can have singleton turned off', async () => {
  setupBasePumpkinsProject(ctx, {
    package: {
      pumpkins: {
        singleton: false,
      },
    },
  })

  ctx.fs.write(
    'schema.ts',
    `
      import { queryType, objectType } from 'pumpkins'

      export const Query = queryType({
        definition(t) {
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

      export const Foo = objectType({
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
      import { createApp } from 'pumpkins'
      import { Foo, Query } from './schema'

      createApp({ types: [Foo, Query] }).server.start()
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
})
