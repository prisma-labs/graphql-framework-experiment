import { introspectionQuery } from 'graphql'
import { setupE2EContext } from '../../src/lib/e2e-testing'
import { DEFAULT_BUILD_FOLDER_NAME } from '../../src/lib/layout'
import { CONVENTIONAL_SCHEMA_FILE_NAME } from '../../src/lib/layout/schema-modules'

/**
 * This function is shared between e2e tests and system tests
 */
export async function e2eTestApp(ctx: ReturnType<typeof setupE2EContext>) {
  // Cover addToContext feature
  await ctx.fs.writeAsync(
    `./src/add-to-context/${CONVENTIONAL_SCHEMA_FILE_NAME}`,
    `
        import { schema } from 'nexus-future'
  
        export interface B {
          foo: number
        }
  
        const b: B = { foo: 1 }
  
        schema.addToContext(req => {
          return { a: 1, b: b }
        })
    
        schema.extendType({
          type: 'Query',
          definition(t) { 
            t.int('a', (_parent, _args, ctx) => { 
              return ctx.a + ctx.b.foo
            })
          }
        })
      `
  )

  // Cover backing-types feature
  await ctx.fs.writeAsync(
    `./src/backing-types/${CONVENTIONAL_SCHEMA_FILE_NAME}`,
    `
          import { schema } from 'nexus-future'
    
          export type CustomBackingType = {
            field1: string
            field2: string
          }
    
          schema.objectType({
            name: 'TestBackingType',
            rootTyping: 'CustomBackingType',
            definition(t) {
              t.string('test', root => root.field1 + root.field2)
            }
          })
    
          schema.extendType({
            type: 'Query',
            definition(t) {     
              t.field('testBackingType', {
                type: 'TestBackingType',
                resolve() {
                  return {
                    field1: 'abc',
                    field2: 'def',
                  }
                }
              })
            }
          })
        `
  )

  // Run dev and query graphql api
  await ctx.spawnNexus(['dev'], async (data, proc) => {
    if (data.includes('server:listening')) {
      let result: any
      result = await ctx.client.request(`{
          worlds {
            id
            name
            population
          }
        }`)
      expect(result).toMatchSnapshot('query')

      result = await ctx.client.request(introspectionQuery)
      expect(result).toMatchSnapshot('introspection')

      result = await ctx.client.request(`{ a }`)
      expect(result).toMatchSnapshot('addToContext query')

      result = await ctx.client.request(`{ testBackingType { test } }`)
      expect(result).toMatchSnapshot('backing type query')

      proc.kill()
    }
  })

  // Run build
  let res

  res = await ctx.spawnNexus(['build'], () => {})

  expect(res.data).toContain('success')
  expect(res.exitCode).toStrictEqual(0)

  // Run built app and query graphql api
  await ctx.spawn(['node', DEFAULT_BUILD_FOLDER_NAME], async (data, proc) => {
    if (data.includes('server:listening')) {
      let result: any
      result = await ctx.client.request(`{
          worlds {
            id
            name
            population
          }
        }`)
      expect(result).toMatchSnapshot('built app query')

      result = await ctx.client.request(introspectionQuery)
      expect(result).toMatchSnapshot('built app introspection')

      result = await ctx.client.request(`{ a }`)
      expect(result).toMatchSnapshot('built app addToContext query')

      result = await ctx.client.request(`{ testBackingType { test } }`)
      expect(result).toMatchSnapshot('built app backing type query')

      proc.kill()
    }
  })

  // Run the built app from a different CWD than the project root
  await ctx.spawn(
    ['node', DEFAULT_BUILD_FOLDER_NAME],
    async (data, proc) => {
      if (data.includes('server:listening')) {
        proc.kill()
      }
    },
    { cwd: '/foo/bar' }
  )

  //
  // Cover using a plugin
  //

  // Install a plugin
  const nexusPluginPrismaVersion =
    process.env.NEXUS_PLUGIN_PRISMA_VERSION ?? 'latest'

  await ctx.spawn([
    'npm',
    'install',
    `nexus-prisma-plugin@${nexusPluginPrismaVersion}`,
  ])
  await ctx.fs.writeAsync(
    './prisma/schema.prisma',
    `
      datasource db {
        provider = "SQLite"
        url      = "prisma/db.dev"
      }

      generator prisma_client {
        provider = "prisma-client-js"
      }

      model Foo {
        id         Int    @id @default(autoincrement())
      }      
    `
  )
  await ctx.fs.writeAsync(
    `./src/prisma-plugin/${CONVENTIONAL_SCHEMA_FILE_NAME}`,
    `
      import { schema } from 'nexus-future' 

      schema.objectType({
        name: 'Foo',
        definition(t) {
          t.model.id()
        }
      })
    `
  )

  // Run dev with plugin
  await ctx.spawnNexus(['dev'], async (data, proc) => {
    if (data.includes('server:listening')) {
      proc.kill()
    }
  })

  // Build app with plugin
  res = await ctx.spawnNexus(['build'], () => {})

  expect(res.data).toContain('success')
  expect(res.exitCode).toStrictEqual(0)

  // Run built app with plugin
  await ctx.spawn(['node', DEFAULT_BUILD_FOLDER_NAME], async (data, proc) => {
    if (data.includes('server:listening')) {
      proc.kill()
    }
  })
}
