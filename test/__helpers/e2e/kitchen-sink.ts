import { introspectionQuery } from 'graphql'
import { ConnectableObservable, Subscription, timer } from 'rxjs'
import { refCount, takeUntil } from 'rxjs/operators'
import { createE2EContext, E2EContext } from '../../../src/lib/e2e-testing'
import { rootLogger } from '../../../src/lib/nexus-logger'
import { bufferOutput, takeUntilServerListening } from './utils'

const log = rootLogger.child('e2e').child('kitchenSink')

/**
 * Test creating an app, creating a plugin, and then using that plugin in the
 * app. Along the way build and dev are tested multiple times, and more.
 */
export async function e2eKitchenSink(app: E2EContext) {
  let sub: Subscription
  let proc: ConnectableObservable<string>
  let output: string
  let response: any

  //-------------------------------------------------
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
    `./api/add-to-context/graphql.ts`,
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
    `./api/backing-types/graphql.ts`,
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

  //-------------------------------------------------
  log.warn('use global cli to interact with local project')

  if (app.usingLocalNexus) {
    await app
      .spawn(['yarn', 'global', 'add', app.usingLocalNexus.path])
      .pipe(refCount(), bufferOutput)
      .toPromise()
  } else {
    await app.spawn(['yarn', 'global', 'add', app.useNexusVersion]).pipe(refCount(), bufferOutput).toPromise()
  }
  // force the local ver to something so we have confidence that global did
  // interact with local and so that we have stable snapshot.
  const pjpath = app.fs.path('node_modules/nexus/package.json')
  const pjoriginal = app.fs.read(pjpath, 'json')
  app.fs.write(pjpath, { ...pjoriginal, version: '0.0.0-local' })
  const result = await app
    .spawn(['nexus', '-v'], {
      cwd: app.dir,
      env: { ...process.env, LOG_LEVEL: 'warn' },
    })
    .pipe(refCount(), bufferOutput)
    .toPromise()
  app.fs.write(pjpath, pjoriginal)

  // Windows/node-pty seems to output a bunch of other characters
  // so use `toContaine` instead of `toEqual`
  expect(result.trim()).toContain('nexus@0.0.0-local')

  //-------------------------------------------------
  log.warn('run dev & test watcher settings')

  proc = app.nexus(['dev'])
  sub = proc.connect()
  await proc.pipe(takeUntilServerListening).toPromise()

  const pendingOutput = proc.pipe(bufferOutput, takeUntil(timer(5000))).toPromise()

  // file events we should NOT see
  app.fs.write('api/.foo.ts', 'ignoreme')
  // app.fs.write('api/.next/foo.ts', 'ignoreme')
  // app.fs.append('api/.foo.ts', ' updated')

  // file events we should see
  // app.fs.write('api/foo2.ts', 'seeme')
  // app.fs.write('api/next/foo.ts', 'seeme')
  // app.fs.append('api/foo.ts', ' updated')

  output = (await pendingOutput) ?? ''
  // todo leverage json logging to do structured asserts
  // on macOS undefined, on linux ".\n", ... so we use a match instead of rigid equal check
  expect(output).not.toMatch(/restarting|api\/\.foo\.ts/)
  sub.unsubscribe()

  //-------------------------------------------------
  log.warn('run dev & query graphql api')

  await devAndBuildApp()

  log.warn('Build and dev again without an app.ts entrypoint')
  await app.fs.removeAsync('./api/app.ts')

  await devAndBuildApp()

  //-------------------------------------------------
  log.warn('create plugin')

  const pluginProject = createE2EContext({
    ...app.config,
    dir: app.getTmpDir('e2e-plugin'),
  })

  if (app.usingLocalNexus?.createPluginWithThis) {
    output = await pluginProject.localNexusCreatePlugin!({ name: 'foobar' })
      .pipe(refCount(), bufferOutput)
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
      .pipe(refCount(), bufferOutput)
      .toPromise()
  }

  //-------------------------------------------------
  log.warn('build plugin')

  await pluginProject.spawn(['yarn', 'build']).refCount().pipe(bufferOutput).toPromise()

  //-------------------------------------------------
  log.warn('install plugin into app via file path')

  await app.spawn(['yarn', 'add', pluginProject.dir]).pipe(refCount(), bufferOutput).toPromise()

  //-------------------------------------------------
  log.warn('with plugin, dev app')

  await app.fs.writeAsync(
    './api/app.ts',
    `
    import { use } from 'nexus'
    import { plugin } from 'nexus-plugin-foobar'

    use(plugin())
  `
  )

  proc = app.nexus(['dev'])
  sub = proc.connect()

  output = await proc.pipe(takeUntilServerListening, bufferOutput).toPromise()

  expect(output).toContain('dev.onStart hook from foobar')

  await app.client.send(`{
          worlds {
            id
            name
            population
          }
        }`)

  sub.unsubscribe()

  //-------------------------------------------------
  log.warn('with plugin, build app')

  output = await app.nexus(['build']).pipe(refCount(), bufferOutput).toPromise()

  expect(output).toContain('build.onStart hook from foobar')
  expect(output).toContain('success')

  /**
   * run nexus dev & nexus build, along with a few checks within
   */
  async function devAndBuildApp() {
    proc = app.nexus(['dev'])
    sub = proc.connect()

    await proc.pipe(takeUntilServerListening).toPromise()

    response = await app.client.send(`{
      worlds {
        id
        name
        population
      }
    }`)
    expect(response).toMatchSnapshot('query')

    response = await app.client.send(introspectionQuery)
    expect(response).toMatchSnapshot('introspection')

    response = await app.client.send(`{ a }`)
    expect(response).toMatchSnapshot('addToContext query')

    response = await app.client.send(`{ testBackingType { test } }`)
    expect(response).toMatchSnapshot('backing type query')

    sub.unsubscribe()

    //-------------------------------------------------
    log.warn('run build')

    output = await app.nexus(['build']).pipe(refCount(), bufferOutput).toPromise()
    expect(output).toContain('success')

    //-------------------------------------------------
    log.warn('run built app and query graphql api')

    proc = app.spawn(['npm', 'run', 'start'])
    sub = proc.connect()

    await proc.pipe(takeUntilServerListening).toPromise()

    response = await app.client.send(`{
      worlds {
        id
        name
        population
      }
    }`)
    expect(response).toMatchSnapshot('built app query')

    response = await app.client.send(introspectionQuery)
    expect(response).toMatchSnapshot('built app introspection')

    response = await app.client.send(`{ a }`)
    expect(response).toMatchSnapshot('built app addToContext query')

    response = await app.client.send(`{ testBackingType { test } }`)
    expect(response).toMatchSnapshot('built app backing type query')

    sub.unsubscribe()

    //-------------------------------------------------
    log.warn('run built app from a different CWD than the project root')

    await app.spawn(['npm', 'run', 'start']).pipe(refCount(), takeUntilServerListening).toPromise()
  }
}
