import { withContext, gitFixture, setupBasePumpkinsProject } from '../__helpers'

const ctx = withContext()
  .use(gitFixture)
  .build()

// TODO integration test showing built app can boot and accept queries

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

  expect(() => ctx.run('yarn -s pumpkins build'))
    .toThrowErrorMatchingInlineSnapshot(`
"
      The following command failed to complete successfully:

          yarn -s pumpkins build

      Becuase of this error output by it:

          Error: 
      Nexus artifact generation failed with exit code \\"1\\". The following stderr was captured:
          app is not defined
    at Object.generateArtifacts (/private/var/folders/6g/4nk3wj214d3998979vzfm_r80000gn/T/tmp-45315iTLJ7Y5yiNUJ_test_context/node_modules/pumpkins/src/utils/artifact-generation.ts:42:19)
    at Build.generateArtifacts (/private/var/folders/6g/4nk3wj214d3998979vzfm_r80000gn/T/tmp-45315iTLJ7Y5yiNUJ_test_context/node_modules/pumpkins/src/cli/commands/build.ts:48:35)
    at Build.run (/private/var/folders/6g/4nk3wj214d3998979vzfm_r80000gn/T/tmp-45315iTLJ7Y5yiNUJ_test_context/node_modules/pumpkins/src/cli/commands/build.ts:39:5)
    at Build._run (/private/var/folders/6g/4nk3wj214d3998979vzfm_r80000gn/T/tmp-45315iTLJ7Y5yiNUJ_test_context/node_modules/pumpkins/node_modules/@oclif/command/lib/command.js:44:20)
    at Config.runCommand (/private/var/folders/6g/4nk3wj214d3998979vzfm_r80000gn/T/tmp-45315iTLJ7Y5yiNUJ_test_context/node_modules/pumpkins/node_modules/@oclif/config/lib/config.js:151:9)
    at Main.run (/private/var/folders/6g/4nk3wj214d3998979vzfm_r80000gn/T/tmp-45315iTLJ7Y5yiNUJ_test_context/node_modules/pumpkins/node_modules/@oclif/command/lib/main.js:21:9)
    at Main._run (/private/var/folders/6g/4nk3wj214d3998979vzfm_r80000gn/T/tmp-45315iTLJ7Y5yiNUJ_test_context/node_modules/pumpkins/node_modules/@oclif/command/lib/command.js:44:20)

    "
`)
})
