import getPort from 'get-port'
import { GraphQLClient } from 'graphql-request'
import * as Lo from 'lodash'
import * as Plugin from '../core/plugin'
import * as app from './index'
import * as Layout from './layout'
import * as singletonChecks from './singleton-checks'

type AppClient = {
  query: GraphQLClient['request']
}

export function createAppClient(apiUrl: string): AppClient {
  const client = new GraphQLClient(apiUrl)

  return {
    query(queryString, variables) {
      return client.request(queryString, variables)
    },
  }
}

export interface TestContextAppCore {
  query: AppClient['query']
  server: {
    start: () => Promise<void>
    stop: () => Promise<void>
  }
}

export interface TestContextCore {
  app: TestContextAppCore
}

declare global {
  interface nexusFutureTestContextApp extends TestContextAppCore {}

  interface nexusFutureTestContextRoot {
    app: nexusFutureTestContextApp
  }
}

export type TestContext = nexusFutureTestContextRoot

/**
 * Setup a test context providing utilities to query against your GraphQL API
 *
 * @example
 *
 * With jest
 * ```
 * import { setupTest, TestContext } from 'nexus-future/testing'
 *
 * let testCtx: TestContext
 *
 * beforeAll(async () => {
 *  testCtx = await setupTest()
 *  await testCtx.server.start()
 * })
 *
 * afterAll(async () => {
 *  await testCtx.server.stop()
 * })
 * ```
 */
export async function createTestContext(): Promise<TestContext> {
  // Guarantee that development mode features are on
  process.env.NEXUS_STAGE = 'dev'

  const port = await getPort({ port: getPort.makeRange(4000, 6000) })
  const apiUrl = `http://localhost:${port}/graphql`

  const oldServerStart = app.server.start

  app.server.start = async () => {
    const appModule = await Layout.findAppModule()

    if (appModule) {
      require(appModule)
    }

    app.settings.change({
      server: {
        port,
        playground: false,
        startMessage: () => '',
      },
    })

    if (singletonChecks.state.is_was_server_start_called === false) {
      await oldServerStart()
    } else {
      return Promise.resolve()
    }
  }

  const appClient = createAppClient(apiUrl)
  const testContextCore: TestContextCore = {
    app: {
      query: appClient.query,
      server: {
        start: app.server.start,
        stop: app.server.stop,
      },
    },
  }

  const testContextContributions = await Plugin.loadAllTestingPluginsFromPackageJson()

  for (const testContextContribution of testContextContributions) {
    Lo.merge(testContextCore, testContextContribution)
  }

  return testContextCore as TestContext
}
