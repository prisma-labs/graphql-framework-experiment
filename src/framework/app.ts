import * as HTTP from 'http'
import * as Lo from 'lodash'
import * as Plugin from '../core/plugin'
import * as Logger from '../lib/logger'
import * as Layout from './layout'
import * as Schema from './schema'
import * as Server from './server'
import * as singletonChecks from './singleton-checks'

const log = Logger.create({ name: 'app' })

type Request = HTTP.IncomingMessage & { log: Logger.Logger }

// todo the jsdoc below is lost on the destructured object exports later on...
// todo plugins could augment the request
// plugins will be able to use typegen to signal this fact
// all places in the framework where the req object is referenced should be
// actually referencing the typegen version, so that it reflects the req +
// plugin augmentations type
type ContextContributor<Req, T extends {} = any> = (req: Req) => T

export type App = {
  /**
   * [API Reference](https://nexus-future.now.sh/#/references/api?id=logger)  ⌁  [Guide](https://nexus-future.now.sh/#/guides/logging)
   *
   * ### todo
   *
   * @examples
   *
   * ```ts
   * import { logger } from 'nexus-future'
   *
   * log.info('boot')
   * ```
   */
  log: Logger.Logger
  /**
   * [API Reference](https://nexus-future.now.sh/#/references/api?id=server)  ⌁  [Guide](todo)
   *
   * ### todo
   *
   * @example
   *
   * ```ts
   * import { server } from 'nexus-future'
   *
   * server.start()
   * ```
   *
   * @remarks
   *
   * Framework Notes:
   *
   *   - If your app does not call server.start then Nexus will. It is idiomatic to allow Nexus to take care of this. If you deviate, we would love to learn about your use-case!
   *
   */
  server: Server.ServerWithCustomizer
  /**
   * todo
   *
   * @example
   *
   * import { log, settings } from 'nexus-future'
   *
   * settings.change({
   *   server: {
   *     startMessage: info => {
   *       settings.original.server.startMessage(info)
   *       log.warn('stowaway message! :p')
   *     },
   *   },
   * })
   */
  settings: Settings
  /**
   * [API Reference](https://nexus-future.now.sh/#/references/api?id=appschema) // [Guide](todo)
   *
   * ### todo
   *
   * @example
   *
   * ```ts
   * import { schema } from 'nexus-future'
   *
   * schema.objectType({
   *   name: 'Foo',
   *   definition(t) {
   *     t.id('id')
   *   },
   * })
   * ```
   */
  schema: Schema.Schema & {
    // addToContext is a bridge between two components, schema and server, so
    // its not in schema currently...

    /**
     * todo
     */
    addToContext: <Req extends any = Request, T extends {} = any>(
      contextContributor: ContextContributor<Req, T>
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
 * TODO extract and improve config type
 */
export function create(): App {
  const plugins: Plugin.RuntimeContributions[] = []
  // Automatically use all installed plugins
  // TODO during build step we should turn this into static imports, not unlike
  // the schema module imports system.
  plugins.push(...Plugin.loadAllRuntimePluginsFromPackageJsonSync())

  const contextContributors: ContextContributor<any>[] = []

  const server = Server.create()
  const schema = Schema.create()

  const settings: Settings = {
    change(newSettings) {
      if (newSettings.logger) {
        log.settings(newSettings.logger)
      }
      if (newSettings.schema) {
        schema.private.settings.change(newSettings.schema)
      }
      if (newSettings.server) {
        Object.assign(settings.current.server, newSettings.server)
      }
    },
    current: {
      logger: log.settings,
      schema: schema.private.settings.data,
      server: { ...Server.defaultExtraSettings },
    },
    original: Lo.cloneDeep({
      logger: log.settings,
      schema: schema.private.settings.data,
      server: { ...Server.defaultExtraSettings },
    }),
  }

  const api: App = {
    log,
    settings,
    schema: {
      addToContext(contextContributor) {
        contextContributors.push(contextContributor)
        return api
      },
      ...schema.public,
    },
    server: {
      /**
       * Start the server. If you do not call this explicitly then nexus will
       * for you. You should not normally need to call this function yourself.
       */
      async start() {
        // During development we dynamically import all the schema modules
        // TODO IDEA we have concept of schema module and schema dir
        //      add a "refactor" command to toggle between them

        // During dev mode we will dynamically require the user's graphql modules.
        // At build time we inline static imports.
        // This code MUST run after user/system has had chance to run global installation
        if (process.env.NEXUS_STAGE === 'dev') {
          Layout.schema.importModules()
        }

        const nexusConfig = Schema.createInternalConfig(plugins)
        const compiledSchema = await schema.private.compile(nexusConfig)

        if (schema.private.isSchemaEmpty()) {
          log.warn(Layout.schema.emptyExceptionMessage())
        }

        const result = server.createAndStart({
          schema: compiledSchema,
          plugins,
          contextContributors,
          settings,
        })

        // Track the start call so that we can know in entrypoint whether to run
        // or not start for the user.
        singletonChecks.state.is_was_server_start_called = true

        return result
      },
      stop() {
        return server.stop()
      },
      custom(customizer) {
        server.setCustomizer(customizer)
      },
    },
  }

  return api
}
