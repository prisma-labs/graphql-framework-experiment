import * as Lo from 'lodash'
import * as Logger from '../lib/logger'
import * as Plugin from '../lib/plugin'
import * as Schema from './schema'
import * as Server from './server'
import app from '.'
import { stripIndent } from 'common-tags'

const log = Logger.create({ name: 'app' })

// todo the jsdoc below is lost on the destructured object exports later on...
export interface App {
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
  schema: Schema.Schema

  use(plugin: Plugin.Plugin): void
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

export type InternalApp = App & {
  __state: {
    plugins: Plugin.Plugin[]
    isWasServerStartCalled: boolean
  }
}

/**
 * Crate an app instance
 */
export function create(): App {
  const __state: InternalApp['__state'] = {
    plugins: [],
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

  const api: InternalApp = {
    __state,
    log: log,
    settings: settings,
    schema: schemaComponent.public,
    use(plugin) {
      if (__state.isWasServerStartCalled === true) {
        log.warn(stripIndent`
          A plugin was ignored because it was loaded after the server was started
          Make sure to call \`use\` before you call \`server.start\`
        `)
      }

      __state.plugins.push(plugin)
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
        __state.isWasServerStartCalled = true

        if (process.env.NEXUS_DISABLE_SERVER === 'true') {
          return
        }

        const plugins = await Plugin.loadRuntimePluginsFromEntrypoints(__state.plugins)
        const graphqlSchema = await schemaComponent.private.makeSchema(plugins)

        await server.setupAndStart({
          settings: settings,
          schema: graphqlSchema,
          plugins,
          contextContributors: schemaComponent.private.state.contextContributors,
        })
      },
      stop() {
        return server.stop()
      },
    },
  }

  return api
}
