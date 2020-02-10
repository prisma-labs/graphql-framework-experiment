import * as HTTP from 'http'
import * as Lo from 'lodash'
import * as Plugin from '../core/plugin'
import * as Logger from '../lib/logger'
import { sendServerReadySignalToDevModeMaster } from './dev-mode'
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
type ContextContributor<T extends {}> = (req: Request) => T

export type App = {
  /**
   * [API Reference](https://nexus-future.now.sh/#/references/api?id=logger)  ⌁  [Guide](https://nexus-future.now.sh/#/guides/logging)
   *
   * ### todo
   */
  log: Logger.Logger
  /**
   * [API Reference](https://nexus-future.now.sh/#/references/api?id=server)  ⌁  [Guide](todo)
   *
   * ### todo
   *
   */
  server: Server.ServerWithCustom
  /**
   * todo
   */
  settings: Settings
  /**
   * [API Reference](https://nexus-future.now.sh/#/references/api?id=appschema) // [Guide](todo)
   *
   * ### todo
   */
  schema: Schema.Schema & {
    // addToContext is a bridge between two components, schema and server, so
    // its not in schema currently...

    /**
     * todo
     */
    addToContext: <T extends {}>(
      contextContributor: ContextContributor<T>
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
type Settings = {
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

  let server: Server.Server | null = null
  let customServerHook: Server.CustomServerHook | null = null

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
      async start(): Promise<void> {
        // Track the start call so that we can know in entrypoint whether to run
        // or not start for the user.
        singletonChecks.state.is_was_server_start_called = true
        // During development we dynamically import all the schema modules
        //
        // TODO IDEA we have concept of schema module and schema dir
        //      add a "refactor" command to toggle between them
        // TODO put behind dev-mode guard
        // TODO static imports codegen at build time
        // TODO do not assume root source folder called `server`
        // TODO do not assume TS
        // TODO refactor and put a system behind this holy mother of...

        // During dev mode we will dynamically require the user's schema modules.
        // At build time we inline static imports.
        // This code MUST run after user/system has had chance to run global installation
        if (process.env.NEXUS_STAGE === 'dev') {
          Schema.importModules()
        }

        const nexusConfig = Schema.createInternalConfig(plugins)
        const compiledSchema = await schema.private.compile(nexusConfig)

        if (schema.private.types.length === 0) {
          log.warn(
            'Your GraphQL schema is empty. Make sure your GraphQL schema lives in a `schema.ts` file or some `schema/` directories'
          )
        }

        const defaultServer = Server.createDefaultServer({
          schema: compiledSchema,
          plugins,
          contextContributors,
          ...settings.current.server,
        })

        if (customServerHook) {
          const customServer = await customServerHook({
            schema: compiledSchema,
            defaultServer,
            settings: settings.current,
          })

          if (!customServer.start) {
            log.error(
              'Your custom server is missing a required `start` function'
            )
          }

          if (!customServer.stop) {
            log.error(
              'Your custom server is missing a required `stop` function'
            )
          }

          server = customServer
        } else {
          server = defaultServer
        }

        await server.start()
        sendServerReadySignalToDevModeMaster()
      },
      async stop() {
        return server?.stop()
      },
      async custom(hook) {
        if (singletonChecks.state.is_was_server_start_called) {
          log.warn(
            'You called `server.start` before `server.custom`. Your custom server might not be used.'
          )
        }

        customServerHook = hook
      },
    },
  }

  return api
}
