import getPort from 'get-port'
import { GraphQLClient } from 'graphql-request'
import { App } from './app'
import * as Layout from './layout'

type AppClient = {
  query: GraphQLClient['request']
}

export function createQueryClient(apiUrl: string): AppClient {
  const client = new GraphQLClient(apiUrl)

  return {
    query(queryString, variables) {
      return client.request(queryString, variables)
    },
  }
}

export type TestContext = {
  app: AppClient
  teardown: () => Promise<void>
}

/**
 * Setup a test context providing utilities to query against your GraphQL API
 */
export async function setupTest(): Promise<TestContext> {
  process.env.GRAPHQL_SANTA_STAGE = 'dev'

  const port = await getPort({ port: getPort.makeRange(4000, 6000) })
  const apiUrl = `http://localhost:${port}/graphql`

  const app = require('./index').app as App

  const oldServerStart = app.server.start

  app.server.start = () => {
    return oldServerStart({
      port,
      playground: false,
      introspection: false,
      startMessage: () => '',
    })
  }

  const appModule = await Layout.findAppModule()

  if (appModule) {
    require(appModule)
  }

  const wasServerStartCalled = require('./singleton-checks').state
    .is_was_server_start_called

  if (!wasServerStartCalled) {
    await app.server.start()
  }

  return {
    app: createQueryClient(apiUrl),
    teardown() {
      return app.server.stop()
    },
  }
}
