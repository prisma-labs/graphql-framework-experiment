import { isLeft } from 'fp-ts/lib/Either'
import getPort from 'get-port'
import * as Lo from 'lodash'
import { GraphQLClient } from '../lib/graphql-client'
import * as Layout from '../lib/layout'
import { rootLogger } from '../lib/nexus-logger'
import * as PluginRuntime from '../lib/plugin'
import * as PluginWorktime from '../lib/plugin/worktime'
import { rightOrFatal } from '../lib/utils'
import app from '../runtime'
import { PrivateApp } from '../runtime/app'
import { createDevAppRunner } from '../runtime/start'
import { CreateTestContextOptions, TestContext, TestContextCore } from './types'

const pluginLogger = rootLogger.child('plugin')

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
  const layout = rightOrFatal(
    await Layout.create({ entrypointPath: opts?.entrypointPath, projectRoot: opts?.projectRoot })
  )
  const pluginManifests = await PluginWorktime.getUsedPlugins(layout)
  const randomStartPort = Math.floor(Math.random() * (6000 - 4000)) + 4000
  const randomPort = await getPort({ port: getPort.makeRange(randomStartPort, 6000) })
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
  const client = new GraphQLClient(apiUrl)
  const api: TestContextCore = {
    client,
    app: {
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
