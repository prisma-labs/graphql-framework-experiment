import { introspectionQuery } from 'graphql'
import { ConnectableObservable, Subscription } from 'rxjs'
import { refCount } from 'rxjs/operators'
import { E2EContext } from '../../../src/lib/e2e-testing'
import { rootLogger } from '../../../src/lib/nexus-logger'
import { bufferOutput, takeUntilServerListening } from './utils'

const log = rootLogger.child('e2e-testing')

/**
 * Smoketest the user journey through create app with prisma SQLite databsae.
 */
export async function e2ePrismaApp(app: E2EContext) {
  log.warn('create prisma app')
  let sub: Subscription
  let proc: ConnectableObservable<string>
  let output: string
  let response: any

  if (app.usingLocalNexus?.createAppWithThis) {
    await app.localNexusCreateApp!({
      databaseType: 'SQLite',
      packageManagerType: 'yarn',
    })
      .pipe(refCount(), takeUntilServerListening)
      .toPromise()
  } else {
    await app
      .npxNexusCreateApp({
        databaseType: 'SQLite',
        packageManagerType: 'yarn',
        nexusVersion: app.useNexusVersion,
      })
      .pipe(refCount(), takeUntilServerListening)
      .toPromise()
  }

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

  sub.unsubscribe()

  log.warn('run build')

  output = await app.nexus(['build']).pipe(refCount(), bufferOutput).toPromise()
  expect(output).toContain('success')
}
