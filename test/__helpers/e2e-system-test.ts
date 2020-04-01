import { introspectionQuery } from 'graphql'
import { setupE2EContext, SpawnResult } from '../../src/lib/e2e-testing'
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
  appContext: ReturnType<typeof setupE2EContext>
) {
  const SERVER_LISTENING_EVENT = 'server listening'
  const PLUGIN_CREATED_EVENT = 'Done! To get started'
  let res: SpawnResult

  log.warn('create app')

  if (options.local) {
    res = await appContext.localNexusCreateApp(
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
    res = await appContext.npxNexusCreateApp(
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

  // Cover addToContext feature
  await appContext.fs.writeAsync(
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
  await appContext.fs.writeAsync(
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

  await appContext.nexus(['dev'], async (data, proc) => {
    if (data.includes(SERVER_LISTENING_EVENT)) {
      let result: any
      result = await appContext.client.request(`{
          worlds {
            id
            name
            population
          }
        }`)
      expect(result).toMatchSnapshot('query')

      result = await appContext.client.request(introspectionQuery)
      expect(result).toMatchSnapshot('introspection')

      result = await appContext.client.request(`{ a }`)
      expect(result).toMatchSnapshot('addToContext query')

      result = await appContext.client.request(`{ testBackingType { test } }`)
      expect(result).toMatchSnapshot('backing type query')

      proc.kill()
    }
  })

  // Run build
  log.warn('run build')

  res = await appContext.nexus(['build'], () => {})

  expect(res.data).toContain('success')

  log.warn('run built app and query graphql api')

  await appContext.node([DEFAULT_BUILD_FOLDER_NAME], async (data, proc) => {
    if (data.includes(SERVER_LISTENING_EVENT)) {
      let result: any
      result = await appContext.client.request(`{
          worlds {
            id
            name
            population
          }
        }`)
      expect(result).toMatchSnapshot('built app query')

      result = await appContext.client.request(introspectionQuery)
      expect(result).toMatchSnapshot('built app introspection')

      result = await appContext.client.request(`{ a }`)
      expect(result).toMatchSnapshot('built app addToContext query')

      result = await appContext.client.request(`{ testBackingType { test } }`)
      expect(result).toMatchSnapshot('built app backing type query')

      proc.kill()
    }
  })

  log.warn('run built app from a different CWD than the project root')

  await appContext.node(
    [appContext.fs.path(DEFAULT_BUILD_FOLDER_NAME)],
    async (data, proc) => {
      if (data.includes(SERVER_LISTENING_EVENT)) {
        proc.kill()
      }
    },
    { cwd: '/' }
  )

  log.warn('create plugin')

  const pluginContext = setupE2EContext({
    ...appContext.settings,
    testProjectDir: appContext.getTmpDir('e2e-plugin'),
  })

  if (options.local) {
    res = await pluginContext.localNexusCreatePlugin({ name: 'foobar' })
  } else {
    res = await pluginContext.npxNexusCreatePlugin({
      name: 'foobar',
      nexusVersion: process.env.E2E_NEXUS_VERSION ?? 'latest',
    })
  }

  expect(res.data).toContain(PLUGIN_CREATED_EVENT)

  log.warn('build plugin')
  res = await pluginContext.spawn(['yarn', 'build'])

  log.warn('install plugin into app via file path')
  await appContext.spawn(['npm', 'install', pluginContext.projectDir])

  log.warn('with plugin, dev app')

  res = await appContext.nexus(['dev'], async (data, proc) => {
    if (data.includes(SERVER_LISTENING_EVENT)) {
      await appContext.client.request(`{
          worlds {
            id
            name
            population
          }
        }`)
      proc.kill()
    }
  })

  expect(res.data).toContain('dev.onStart hook from foobar')

  log.warn('with plugin, build app')
  res = await appContext.nexus(['build'], () => {})

  expect(res.data).toContain('build.onStart hook from foobar')
  expect(res.data).toContain('success')
}
