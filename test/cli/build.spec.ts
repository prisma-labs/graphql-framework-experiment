import { withContext, gitFixture } from '../__helpers'

const ctx = withContext()
  .use(gitFixture)
  .build()

it('can build just a schema.ts', async () => {
  ctx.run('yarn init -y')
  ctx.fs.write('tsconfig.json', '{}')
  ctx.fs.write(
    'schema.ts',
    `queryType({
        definition(t) {
          t.field('foo', Foo)
        }
      })

      objectType({
        name: 'Foo'
        definition(t) {
          t.string('bar')
        }
      })
    `
  )

  expect(ctx.cli('build')).toMatchInlineSnapshot(`
    Object {
      "status": 1,
      "stderr": "TypeError [ERR_INVALID_ARG_TYPE]: The \\"path\\" argument must be of type string. Received type undefined
        at Object.getPath [as path] (~/projects/prisma-labs/pumpkins/node_modules/fs-jetpack/lib/jetpack.js:50:29)
        at isPrismaEnabled (~/projects/prisma-labs/pumpkins/src/utils/prisma.ts:26:44)
        at Object.runPrismaGenerators (~/projects/prisma-labs/pumpkins/src/utils/prisma.ts:30:37)
        at Build.run (~/projects/prisma-labs/pumpkins/src/cli/commands/build.ts:11:9)
        at Build._run (~/projects/prisma-labs/pumpkins/node_modules/@oclif/command/lib/command.js:44:20)
        at Config.runCommand (~/projects/prisma-labs/pumpkins/node_modules/@oclif/config/lib/config.js:151:9)
        at Main.run (~/projects/prisma-labs/pumpkins/node_modules/@oclif/command/lib/main.js:21:9)
    ",
      "stdout": "",
    }
  `)
  expect(ctx.fs.exists('dist'))
})
