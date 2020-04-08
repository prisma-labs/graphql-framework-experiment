import { introspectionQuery } from 'graphql'
import { ConnectableObservable, Subscription } from 'rxjs'
import { refCount } from 'rxjs/operators'
import { createE2EContext, E2EContext } from '../../../src/lib/e2e-testing'
import { DEFAULT_BUILD_FOLDER_PATH_RELATIVE_TO_PROJECT_ROOT } from '../../../src/lib/layout'
import { CONVENTIONAL_SCHEMA_FILE_NAME } from '../../../src/lib/layout/schema-modules'
import { rootLogger } from '../../../src/lib/nexus-logger'
import { bufferOutput, takeUntilServerListening } from './utils'

const log = rootLogger.child('e2e').child('kitchen-sink')

/**
 * Test creating an app, creating a plugin, and then using that plugin in the
 * app. Along the way build and dev are tested multiple times, and more.
 */
export async function e2eKitchenSink(app: E2EContext) {
  let sub: Subscription
  let proc: ConnectableObservable<string>
  let output: string
  let response: any

  log.warn('create app')

  if (app.usingLocalNexus?.createAppWithThis) {
    await app.localNexusCreateApp!({
      databaseType: 'NO_DATABASE',
      packageManagerType: 'yarn',
    })
      .pipe(refCount(), takeUntilServerListening)
      .toPromise()
  } else {
    await app
      .npxNexusCreateApp({
        databaseType: 'NO_DATABASE',
        packageManagerType: 'yarn',
        nexusVersion: app.useNexusVersion,
      })
      .pipe(refCount(), takeUntilServerListening)
      .toPromise()
  }

  // Cover addToContext feature
  await app.fs.writeAsync(
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
  await app.fs.writeAsync(
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

  await buildApp()

  log.warn('Build and dev again with an app.ts entrypoint')
  await app.fs.writeAsync('./src/app.ts', '')

  await buildApp()

  log.warn('create plugin')

  const pluginProject = createE2EContext({
    ...app.config,
    dir: app.getTmpDir('e2e-plugin'),
  })

  if (app.usingLocalNexus?.createPluginWithThis) {
    output = await pluginProject.localNexusCreatePlugin!({ name: 'foobar' })
      .refCount()
      .pipe(bufferOutput)
      .toPromise()
  } else {
    output = await pluginProject
      .npxNexusCreatePlugin({
        name: 'foobar',
        nexusVersion: process.env.E2E_NEXUS_VERSION ?? 'latest',
      })
      .pipe(refCount(), bufferOutput)
      .toPromise()
  }

  expect(output).toContain('Done! To get started')

  if (app.usingLocalNexus?.pluginLinksToThis) {
    // We do this so that the plugin is building against the local nexus. Imagine
    // the plugin system is changing, the only way to allow the plugin template to
    // be built against the changes is to work with the local nexus version, not
    // one published to npm.
    await pluginProject
      .spawn(['yarn', 'add', '-D', app.usingLocalNexus.path])
      .refCount()
      .pipe(bufferOutput)
      .toPromise()
  }

  log.warn('build plugin')

  await pluginProject
    .spawn(['yarn', 'build'])
    .refCount()
    .pipe(bufferOutput)
    .toPromise()

  log.warn('install plugin into app via file path')

  await app
    .spawn(['yarn', 'add', pluginProject.dir])
    .pipe(refCount(), bufferOutput)
    .toPromise()

  log.warn('with plugin, dev app')

  proc = app.nexus(['dev'])
  sub = proc.connect()

  output = await proc.pipe(takeUntilServerListening, bufferOutput).toPromise()

  expect(output).toContain('dev.onStart hook from foobar')

  await app.client.request(`{
          worlds {
            id
            name
            population
          }
        }`)

  sub.unsubscribe()

  log.warn('with plugin, build app')

  output = await app.nexus(['build']).pipe(refCount(), bufferOutput).toPromise()

  expect(output).toContain('build.onStart hook from foobar')
  expect(output).toContain('success')

  async function buildApp() {
    proc = app.nexus(['dev'])
    sub = proc.connect()

    await proc.pipe(takeUntilServerListening).toPromise()

    response = await app.client.request(`{
      worlds {
        id
        name
        population
      }
    }`)
    expect(response).toMatchSnapshot('query')

    response = await app.client.request(introspectionQuery)
    expect(response).toMatchSnapshot('introspection')

    response = await app.client.request(`{ a }`)
    expect(response).toMatchSnapshot('addToContext query')

    response = await app.client.request(`{ testBackingType { test } }`)
    expect(response).toMatchSnapshot('backing type query')

    sub.unsubscribe()

    log.warn('run build')

    output = await app
      .nexus(['build'])
      .pipe(refCount(), bufferOutput)
      .toPromise()
    expect(output).toContain('success')

    log.warn('run built app and query graphql api')

    proc = app.node([DEFAULT_BUILD_FOLDER_PATH_RELATIVE_TO_PROJECT_ROOT])
    sub = proc.connect()

    await proc.pipe(takeUntilServerListening).toPromise()

    response = await app.client.request(`{
      worlds {
        id
        name
        population
      }
    }`)
    expect(response).toMatchSnapshot('built app query')

    response = await app.client.request(introspectionQuery)
    expect(response).toMatchSnapshot('built app introspection')

    response = await app.client.request(`{ a }`)
    expect(response).toMatchSnapshot('built app addToContext query')

    response = await app.client.request(`{ testBackingType { test } }`)
    expect(response).toMatchSnapshot('built app backing type query')

    sub.unsubscribe()

    log.warn('run built app from a different CWD than the project root')

    await app
      .node([app.fs.path(DEFAULT_BUILD_FOLDER_PATH_RELATIVE_TO_PROJECT_ROOT)], {
        cwd: '/',
      })
      .pipe(refCount(), takeUntilServerListening)
      .toPromise()
  }
}
