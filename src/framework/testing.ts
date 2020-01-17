import getPort from 'get-port'
import { GraphQLClient } from 'graphql-request'
import * as Lo from 'lodash'
import { app } from './index'
import * as Layout from './layout'
import * as Plugin from './plugin'
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

declare global {
  interface GraphQLSantaTestContextApp {
    query: AppClient['query']
    server: {
      start: () => Promise<void>
      stop: () => Promise<void>
    }
  }

  interface GraphQLSantaTestContextRoot {
    app: GraphQLSantaTestContextApp
  }
}

export type TestContext = GraphQLSantaTestContextRoot

/**
 * Setup a test context providing utilities to query against your GraphQL API
 *
 * @example
 *
 * With jest
 * ```
 * import { setupTest, TestContext } from 'graphql-santa/testing'
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
  process.env.GRAPHQL_SANTA_STAGE = 'dev'

  const port = await getPort({ port: getPort.makeRange(4000, 6000) })
  const apiUrl = `http://localhost:${port}/graphql`

  const oldServerStart = app.server.start

  app.server.start = async () => {
    const appModule = await Layout.findAppModule()

    if (appModule) {
      require(appModule)
    }

    if (singletonChecks.state.is_was_server_start_called === false) {
      await oldServerStart({
        port,
        playground: false,
        introspection: false,
        startMessage: () => '',
      })
    } else {
      return Promise.resolve()
    }
  }

  const appClient = createAppClient(apiUrl)
  const testContext: TestContext = {
    app: {
      query: appClient.query,
      server: {
        start: app.server.start,
        stop: app.server.stop,
      },
    },
  }
  const testingContributions = await Plugin.loadAllTestingPluginsFromPackageJson()

  return testingContributions.reduce<TestContext>((acc, contribution) => {
    return Lo.merge(acc, contribution)
  }, testContext)
}
