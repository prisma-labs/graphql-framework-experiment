import { createWorkspace } from '../__helpers'

const ws = createWorkspace({
  name: 'build',
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
