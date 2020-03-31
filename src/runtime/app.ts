import * as HTTP from 'http'
import * as Lo from 'lodash'
import * as Layout from '../lib/layout'
import * as Logger from '../lib/logger'
import * as Plugin from '../lib/plugin'
import * as Schema from './schema'
import * as Server from './server'

const log = Logger.create({ name: 'app' })

export type Request = HTTP.IncomingMessage & { log: Logger.Logger }

// todo the jsdoc below is lost on the destructured object exports later on...
// todo plugins could augment the request
// plugins will be able to use typegen to signal this fact
// all places in the framework where the req object is referenced should be
// actually referencing the typegen version, so that it reflects the req +
// plugin augmentations type
type ContextContributor<Req> = (req: Req) => Record<string, unknown>

export type App = {
  /**
   * [API Reference](https://www.nexusjs.org/#/api/modules/main/exports/logger)  ⌁  [Guide](todo)
   *
   * ### todo
   */
  log: Logger.Logger
  /**
   * [API Reference](https://www.nexusjs.org/#/api/modules/main/exports/server)  ⌁  [Guide](todo)
   *
   * ### todo
   *
   */
  server: Server.Server
  /**
   * todo
   */
  settings: Settings
  /**
   * [API Reference](https://www.nexusjs.org/#/api/modules/main/exports/schema) // [Guide](todo)
   *
   * ### todo
   */
  schema: Schema.Schema & {
    // addToContext is a bridge between two components, schema and server, so
    // its not in schema currently...

    /**
     * todo
     */
    addToContext: <Req extends any = Request>(
      contextContributor: ContextContributor<Req>
    ) => void
  }
}

type SettingsInput = {
  logger?: Logger.SettingsInput
  schema?: Schema.SettingsInput
  server?: Server.ExtraSettingsInput
}

export type SettingsData = Readonly<{
  logger: Logger.SettingsData
  schema: Schema.SettingsData
  server: Server.ExtraSettingsData
}>

/**
 * todo
 */
export type Settings = {
  /**
   * todo
   */
  original: SettingsData
  /**
   * todo
   */
  current: SettingsData
  /**
   * todo
   */
  change(newSetting: SettingsInput): void
}

/**
 * Crate an app instance
 */
export function create(): App {
  const state: {
    plugins: Plugin.RuntimeContributions[]
    contextContributors: ContextContributor<any>[]
    isWasServerStartCalled: boolean
  } = {
    plugins: [],
    contextContributors: [],
    isWasServerStartCalled: false,
  }

  const server = Server.create()
  const schemaComponent = Schema.create()

  const settings: Settings = {
    change(newSettings) {
      if (newSettings.logger) {
        log.settings(newSettings.logger)
      }
      if (newSettings.schema) {
        schemaComponent.private.settings.change(newSettings.schema)
      }
      if (newSettings.server) {
        Object.assign(settings.current.server, newSettings.server)
      }
    },
    current: {
      logger: log.settings,
      schema: schemaComponent.private.settings.data,
      server: Server.defaultExtraSettings,
    },
    original: Lo.cloneDeep({
      logger: log.settings,
      schema: schemaComponent.private.settings.data,
      server: Server.defaultExtraSettings,
    }),
  }

  const api: App = {
    log: log,
    settings: settings,
    schema: {
      addToContext(contextContributor) {
        state.contextContributors.push(contextContributor)
        return api
      },
      ...schemaComponent.public,
    },
    server: {
      express: server.express,
      /**
       * Start the server. If you do not call this explicitly then nexus will
       * for you. You should not normally need to call this function yourself.
       */
      async start() {
        // Track the start call so that we can know in entrypoint whether to run
        // or not start for the user.
        state.isWasServerStartCalled = true

        const schema = await schemaComponent.private.makeSchema(state.plugins)

        if (schemaComponent.private.isSchemaEmpty()) {
          log.warn(Layout.schema.emptyExceptionMessage())
        }

        await server.setupAndStart({
          settings: settings,
          schema: schema,
          plugins: state.plugins,
          contextContributors: state.contextContributors,
        })
      },
      stop() {
        return server.stop()
      },
    },
  }

  // Private API :(
  const api__: any = api

  api__.__state = state

  api__.__use = function(pluginName: string, plugin: Plugin.RuntimePlugin) {
    state.plugins.push(Plugin.loadRuntimePlugin(pluginName, plugin))
  }

  return api
}
