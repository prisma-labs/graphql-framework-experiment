import { introspectionQuery } from 'graphql'
import { setupE2EContext } from '../../src/lib/e2e-testing'
import { DEFAULT_BUILD_FOLDER_NAME } from '../../src/lib/layout'
import { CONVENTIONAL_SCHEMA_FILE_NAME } from '../../src/lib/layout/schema-modules'
import { rootLogger } from '../../src/lib/nexus-logger'

const log = rootLogger.child('e2e-testing')

interface Options {
  local: boolean
}

/**
 * This function is shared between e2e tests and system tests
 */
export async function e2eTestApp(
  options: Options,
  ctx: ReturnType<typeof setupE2EContext>
) {
  const SERVER_LISTENING_EVENT = 'server listening'
  let res

  log.warn('create app')

  let createAppResult
  if (options.local) {
    createAppResult = await ctx.localNexusCreateApp(
      {
        databaseType: 'NO_DATABASE',
        packageManagerType: 'npm',
      },
      (data, proc) => {
        if (data.includes(SERVER_LISTENING_EVENT)) {
          proc.kill()
        }
      }
    )
  } else {
    createAppResult = await ctx.npxNexusCreateApp(
      {
        databaseType: 'NO_DATABASE',
        packageManagerType: 'npm',
        nexusVersion: process.env.E2E_NEXUS_VERSION ?? 'latest',
      },
      (data, proc) => {
        if (data.includes(SERVER_LISTENING_EVENT)) {
          proc.kill()
        }
      }
    )
  }

  expect(createAppResult.exitCode).toStrictEqual(0)

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

  log.warn('run dev & query graphql api')

  await ctx.nexus(['dev'], async (data, proc) => {
    if (data.includes(SERVER_LISTENING_EVENT)) {
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

  res = await ctx.nexus(['build'], () => {})

  expect(res.data).toContain('success')
  expect(res.exitCode).toStrictEqual(0)

  log.warn('run built app and query graphql api')

  await ctx.node([DEFAULT_BUILD_FOLDER_NAME], async (data, proc) => {
    if (data.includes(SERVER_LISTENING_EVENT)) {
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

  await ctx.node(
    [ctx.fs.path(DEFAULT_BUILD_FOLDER_NAME)],
    async (data, proc) => {
      if (data.includes(SERVER_LISTENING_EVENT)) {
        proc.kill()
      }
    },
    { cwd: '/' }
  )

  log.warn('create plugin')

  const pluginCtx = setupE2EContext({
    ...ctx.settings,
    testProjectDir: ctx.getTmpDir('e2e-plugin'),
  })

  let createPluginResult
  if (options.local) {
    createPluginResult = await pluginCtx.localNexusCreatePlugin(
      { name: 'foobar' },
      (data, proc) => {
        if (data.includes(SERVER_LISTENING_EVENT)) {
          proc.kill()
        }
      }
    )
  } else {
    createPluginResult = await pluginCtx.npxNexusCreatePlugin(
      {
        name: 'foobar',
        nexusVersion: process.env.E2E_NEXUS_VERSION ?? 'latest',
      },
      (data, proc) => {
        if (data.includes(SERVER_LISTENING_EVENT)) {
          proc.kill()
        }
      }
    )
  }

  expect(createPluginResult.exitCode).toStrictEqual(0)

  log.warn('todo build plugin')
  log.warn('todo install plugin into app via file path')
  log.warn('todo with plugin, dev app')
  log.warn('todo with plugin, build app')
}
