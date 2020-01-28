// TODO boot and query to take integration test confidence even further

import { DEFAULT_BUILD_FOLDER_NAME } from '../../src/framework/layout'
import { createWorkspace } from '../__helpers'

const ws = createWorkspace({
  name: 'build',
})

it('exits 1 if typegen errors out', () => {
  ws.fs.write('app.ts', `const foo :: "bar"`)
  const result = ws.run('yarn -s nexus build')
  delete result.error
  expect(result).toMatchSnapshot()
})

it('exits 1 if app does not type check', () => {
  ws.fs.write('app.ts', `const foo: number =  "bar"`)
  const result = ws.run('yarn -s nexus build')
  delete result.error
  expect(result).toMatchSnapshot()
})

it('can build with just a schema module', () => {
  ws.fs.write(
    'schema.ts',
    `
      import { app } from 'nexus-future'

      app.objectType({
        name: 'A',
        definition(t) {
          t.string('a')
        }
      })
    `
  )

  const result = ws.run('yarn -s nexus build')
  expect(result).toMatchSnapshot()
  expect(ws.fs.inspectTree(DEFAULT_BUILD_FOLDER_NAME)).toMatchSnapshot()
})

it('can build with just a schema folder of modules', () => {
  ws.fs.write(
    'schema/a.ts',
    `
      import { app } from 'nexus-future'

      app.objectType({
        name: 'A',
        definition(t) {
          t.string('a')
        }
      })
    `
  )

  const result = ws.run('yarn -s nexus build')
  expect(result).toMatchSnapshot()
  expect(ws.fs.inspectTree(DEFAULT_BUILD_FOLDER_NAME)).toMatchSnapshot()
})

it('can build with schema + app modules', () => {
  ws.fs.write(
    'schema.ts',
    `
      import { app } from 'nexus-future'

      app.objectType({
        name: 'A',
        definition(t) {
          t.string('a')
        }
      })
    `
  )

  ws.fs.write(
    'app.ts',
    `
      import { app } from 'nexus-future'
      app.server.start()
    `
  )

  const result = ws.run('yarn -s nexus build')
  expect(result).toMatchSnapshot()
  expect(ws.fs.inspectTree(DEFAULT_BUILD_FOLDER_NAME)).toMatchSnapshot()
})

it('can nest modules', () => {
  ws.fs.write(
    'graphql/schema.ts',
    `
      import { app } from 'nexus-future'

      app.objectType({
        name: 'A',
        definition(t) {
          t.string('a')
        }
      })
    `
  )

  ws.fs.write(
    'graphql/app.ts',
    `
      import { app } from 'nexus-future'
      app.server.start()
    `
  )

  const result = ws.run('yarn -s nexus build')
  expect(result).toMatchSnapshot()
  expect(ws.fs.inspectTree(DEFAULT_BUILD_FOLDER_NAME)).toMatchSnapshot()
})

it('can build a plugin', () => {
  ws.fs.write(
    'myplugin.ts',
    `	
      import { Plugin } from 'nexus-future'	

      export type Context = {	
        a: 1	
      }	
      	
      export default {	
        name: 'myplugin',	
        context: {	
          typeGen: {
            fields: {
              a: 'number'
            },
          },
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
    `
      import { app } from 'nexus-future'

      app.queryType({	
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

      app.objectType({	
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
      import { app } from 'nexus-future'
      import myplugin from './myplugin'	

      app.use(myplugin).server.start()	
    `
  )

  const result = ws.run('yarn -s nexus build')
  expect(result).toMatchSnapshot()
  expect(ws.fs.inspectTree(DEFAULT_BUILD_FOLDER_NAME)).toMatchSnapshot()
})
