import { introspectionQuery } from 'graphql'
import { setupE2EContext } from '../../src/lib/e2e-testing'
import { DEFAULT_BUILD_FOLDER_NAME } from '../../src/lib/layout'
import { CONVENTIONAL_SCHEMA_FILE_NAME } from '../../src/lib/layout/schema-modules'
import { rootLogger } from '../../src/lib/nexus-logger'

const log = rootLogger.child('e2e-testing')

/**
 * This function is shared between e2e tests and system tests
 */
export async function e2eTestApp(ctx: ReturnType<typeof setupE2EContext>) {
  let res

  // Cover addToContext feature
  await ctx.fs.writeAsync(
    `./src/add-to-context/${CONVENTIONAL_SCHEMA_FILE_NAME}`,
    `
        import { schema } from 'nexus'
  
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
          import { schema } from 'nexus'
    
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

  log.warn('run dev & query graphql api')

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
  log.warn('run build')

  res = await ctx.spawnNexus(['build'], () => {})

  expect(res.data).toContain('success')
  expect(res.exitCode).toStrictEqual(0)

  log.warn('run built app and query graphql api')

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

  log.warn('run built app from a different CWD than the project root')

  await ctx.spawn(
    ['node', ctx.fs.path(DEFAULT_BUILD_FOLDER_NAME)],
    async (data, proc) => {
      if (data.includes('server:listening')) {
        proc.kill()
      }
    },
    { cwd: '/' }
  )

  //
  // Cover using a plugin
  //

  log.warn('Check that prisma plugin can integrate')

  // Install a plugin
  const nexusPluginPrismaVersion =
    process.env.NEXUS_PLUGIN_PRISMA_VERSION ?? 'latest'

  log.warn('Install', { nexusPluginPrismaVersion })

  await ctx.spawn([
    'npm',
    'install',
    `nexus-plugin-prisma@${nexusPluginPrismaVersion}`,
  ])

  await ctx.fs.writeAsync(
    './prisma/schema.prisma',
    `
      datasource db {
        provider = "sqlite"
        url      = "file:data.db"
      }

      generator prisma_client {
        provider = "prisma-client-js"
      }

      model Foo {
        id   Int    @id @default(autoincrement())
        name String
      }      
    `
  )
  await ctx.fs.writeAsync(
    `./src/prisma-plugin/${CONVENTIONAL_SCHEMA_FILE_NAME}`,
    `
      import { schema } from 'nexus' 

      schema.objectType({
        name: 'Foo',
        definition(t) {
          t.model.id()
        }
      })
    `
  )

  await ctx.spawn(['npx', 'prisma2', `geneate`])

  log.warn('run dev with plugin')

  await ctx.spawnNexus(['dev'], async (data, proc) => {
    if (data.includes('server:listening')) {
      proc.kill()
    }
  })

  log.warn('run build with plugin')

  res = await ctx.spawnNexus(['build'], () => {})

  expect(res.data).toContain('success')
  expect(res.exitCode).toStrictEqual(0)

  log.warn('run built app with plugin')

  await ctx.spawn(['node', DEFAULT_BUILD_FOLDER_NAME], async (data, proc) => {
    if (data.includes('server:listening')) {
      proc.kill()
    }
  })
}
