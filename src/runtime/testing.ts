import { isLeft } from 'fp-ts/lib/Either'
import getPort from 'get-port'
import * as Lo from 'lodash'
import app from '.'
import { GraphQLClient } from '../lib/graphql-client'
import * as Layout from '../lib/layout'
import * as PluginRuntime from '../lib/plugin'
import * as PluginWorktime from '../lib/plugin/worktime'
import { PrivateApp } from './app'
import { createDevAppRunner } from './start'
import { rootLogger } from '../lib/nexus-logger'

const pluginLogger = rootLogger.child('plugin')

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
  start: () => Promise<void>
  stop: () => Promise<void>
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

export interface CreateTestContextOptions {
  /**
   * A path to the entrypoint of your app. Only necessary if the entrypoint falls outside of Nexus conventions.
   * You should typically use this if you're using `nexus dev --entrypoint` or `nexus build --entrypoint`.
   */
  entrypointPath?: string
}

/**
 * Setup a test context providing utilities to query against your GraphQL API
 *
 * @example
 *
 * With jest
 * ```ts
 * import { createTestContext, TestContext } from 'nexus/testing'
 *
 * let ctx: TestContext
 *
 * beforeAll(async () => {
 *   ctx = await createTestContext()
 *   await ctx.app.start()
 * })
 *
 * afterAll(async () => {
 *   await ctx.app.stop()
 * })
 * ```
 */
export async function createTestContext(opts?: CreateTestContextOptions): Promise<TestContext> {
  // Guarantee that development mode features are on
  process.env.NEXUS_STAGE = 'dev'

  // todo figure out some caching system here, e.g. imagine jest --watch mode
  const layout = await Layout.create({ entrypointPath: opts?.entrypointPath })
  const pluginManifests = await PluginWorktime.getUsedPlugins(layout)
  const randomPort = await getPort({ port: getPort.makeRange(4000, 6000) })
  const privateApp = app as PrivateApp

  const forcedServerSettings = {
    port: randomPort,
    playground: false, // Disable playground during tests
    startMessage() {}, // Make server silent
  }

  // todo remove these settings hacks once we have https://github.com/graphql-nexus/nexus/issues/758
  const originalSettingsChange = privateApp.settings.change

  privateApp.settings.change({
    server: forcedServerSettings,
  })

  /**
   * If app ever calls app.settings.change, force some server settings anyway
   */
  privateApp.settings.change = (newSettings) => {
    if (newSettings.server !== undefined) {
      newSettings.server = {
        ...newSettings.server,
        ...forcedServerSettings,
      }
    }
    originalSettingsChange(newSettings)
  }

  const appRunner = await createDevAppRunner(layout, privateApp)
  const apiUrl = `http://localhost:${appRunner.port}/graphql`
  const appClient = createAppClient(apiUrl)
  const api: TestContextCore = {
    app: {
      query: appClient.query,
      start: appRunner.start,
      stop: appRunner.stop,
    },
  }

  const testContextContributions = PluginRuntime.importAndLoadTesttimePlugins(pluginManifests)

  for (const testContextContribution of testContextContributions) {
    if (isLeft(testContextContribution)) {
      pluginLogger.error(testContextContribution.left.message, { error: testContextContribution.left })
      continue
    }

    Lo.merge(api, testContextContribution.right)
  }

  return api as TestContext
}
