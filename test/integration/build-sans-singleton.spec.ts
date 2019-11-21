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
    `queryType({
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

      objectType({
        name: 'Foo',
        definition(t) {
          t.string('bar')
        }
      })
    `
  )

  ctx.fs.write('app.ts', `app.server.start()`)

  expect(() => ctx.run('yarn -s pumpkins build')).toThrowError(
    /.*app is not defined.*/
  )
})
