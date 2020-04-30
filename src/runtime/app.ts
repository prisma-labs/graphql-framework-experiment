import * as Logger from '@nexus/logger'
import { stripIndent } from 'common-tags'
import * as Lo from 'lodash'
import * as Plugin from '../lib/plugin'
import * as Schema from './schema'
import * as Server from './server'
import * as NexusSchema from '@nexus/schema'
import * as Reflection from '../lib/reflection'

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
  server?: Server.SettingsInput
}

export type SettingsData = Readonly<{
  logger: Logger.SettingsData
  schema: Schema.SettingsData
  server: Server.SettingsData
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

export type AppState = {
  plugins: () => Plugin.Plugin[]
  schema: () => NexusSchema.core.NexusGraphQLSchema
  isWasServerStartCalled: boolean
}

export type InternalApp = App & {
  __state: AppState
}

/**
 * Crate an app instance
 */
export function create(): App {
  let _plugins: Plugin.Plugin[] = []
  let _schema: NexusSchema.core.NexusGraphQLSchema | null = null

  const __state: InternalApp['__state'] = {
    plugins() {
      return _plugins
    },
    schema() {
      if (_schema === null) {
        throw new Error('GraphQL schema was not built yet. server.start() needs to be run first')
      }

      return _schema
    },
    isWasServerStartCalled: false,
  }

  const server = Server.create()
  const schemaComponent = Schema.create(__state)

  const settings: Settings = {
    change(newSettings) {
      if (newSettings.logger) {
        log.settings(newSettings.logger)
      }
      if (newSettings.schema) {
        schemaComponent.private.settings.change(newSettings.schema)
      }
      if (newSettings.server) {
        server.settings.change(newSettings.server)
      }
    },
    current: {
      logger: log.settings,
      schema: schemaComponent.private.settings.data,
      server: server.settings.data,
    },
    original: Lo.cloneDeep({
      logger: log.settings,
      schema: schemaComponent.private.settings.data,
      server: server.settings.data,
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

      _plugins.push(plugin)
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

        /**
         * If loading plugins, we need to return here, before loading the runtime plugins
         */
         if (Reflection.isReflectionStage('plugin')) {
           return Promise.resolve()
         }

        const plugins = Plugin.importAndLoadRuntimePlugins(__state.plugins())
        const { schema, assertValidSchema } = schemaComponent.private.makeSchema(plugins)

        /**
         * Set the schema in the app state so that the reflection step can access it
         */
        _schema = schema

        /**
         * If execution in in reflection stage, do not run the server
         */
        if (Reflection.isReflectionStage('typegen')) {
          return Promise.resolve()
        }

        /**
         * This needs to be done **after** the reflection step,
         * to make sure typegen can still run in case of missing types
         */
        assertValidSchema()

        await server.setupAndStart({
          schema,
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
