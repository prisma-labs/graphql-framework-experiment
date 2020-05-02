import getPort from 'get-port'
import * as Lo from 'lodash'
import { GraphQLClient } from '../lib/graphql-client'
import * as Layout from '../lib/layout'
import * as Plugin from '../lib/plugin'
import type { PrivateApp } from './app'
import { createDevAppRunner } from './start'

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
  interface NexusTestContextApp extends TestContextAppCore {}

  interface NexusTestContextRoot {
    app: NexusTestContextApp
  }
}

export type TestContext = NexusTestContextRoot

/**
 * Setup a test context providing utilities to query against your GraphQL API
 *
 * @example
 *
 * With jest
 * ```
 * import { setupTest, TestContext } from 'nexus/testing'
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

  // todo figure out some caching system here, e.g. imagine jest --watch mode
  const layout = await Layout.create()
  const pluginManifests = await Plugin.getUsedPlugins(layout)
  const randomPort = await getPort({ port: getPort.makeRange(4000, 6000) })
  const app = require('../index') as PrivateApp

  app.settings.change({
    server: {
      port: randomPort,
      playground: false, // Disable playground during tests
      startMessage() {}, // Make server silent
    },
  })

  const appRunner = await createDevAppRunner(layout, app)
  const apiUrl = `http://localhost:${appRunner.port}/graphql`
  const appClient = createAppClient(apiUrl)
  const testContextCore: TestContextCore = {
    app: {
      query: appClient.query,
      server: {
        start: appRunner.start,
        stop: appRunner.stop,
      },
    },
  }

  const testContextContributions = Plugin.importAndLoadTesttimePlugins(pluginManifests)

  for (const testContextContribution of testContextContributions) {
    Lo.merge(testContextCore, testContextContribution)
  }

  return testContextCore as TestContext
}
