import { withContext, gitFixture } from '../__helpers'

const ctx = withContext()
  .use(gitFixture)
  .build()

it('can build with minimal app.ts + schema.ts', async () => {
  ctx.fs.write(
    'package.json',
    `
      {
        "name": "test-app",
        "dependencies": {
          "pumpkins": "0.0.0"
        },
        "license": "MIT"
      }
    `
  )

  ctx.fs.write(
    'tsconfig.json',
    `
    {
      "compilerOptions": {
        "target": "es2016",
        "module": "commonjs",
        "strict": true,
        "outDir": "dist",
      },
    }
  `
  )

  ctx.fs.write(
    'schema.ts',
    `queryType({
        definition(t) {
          t.field('foo', { type: 'Foo' })
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
      import { createApp } from 'pumpkins'
      createApp().startServer()
    `
  )

  ctx.run('npm link pumpkins')

  expect(ctx.run('npx pumpkins build')).toMatchInlineSnapshot(`
    Object {
      "status": 0,
      "stderr": "",
      "stdout": "🎃  Generating artifacts ...
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
          "size": 91,
          "type": "file",
        },
        Object {
          "name": "app__original__.js",
          "size": 155,
          "type": "file",
        },
        Object {
          "name": "schema.js",
          "size": 182,
          "type": "file",
        },
      ],
      "name": "dist",
      "size": 428,
      "type": "dir",
    }
  `)
})
