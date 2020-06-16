import * as Logger from '@nexus/logger'
import * as NexusSchema from '@nexus/schema'
import { rootLogger } from '../lib/nexus-logger'
import * as Plugin from '../lib/plugin'
import { RuntimeContributions } from '../lib/plugin'
import * as Reflection from '../lib/reflection/stage'
import { Index } from '../lib/utils'
import * as Schema from './schema'
import * as Server from './server'
import { ContextCreator } from './server/server'
import * as Settings from './settings'
import { assertAppNotAssembled } from './utils'
import { builtinScalars } from '../lib/scalars'

const log = Logger.log.child('app')

// WARNING Make sure that jsdoc edits here are ported to runtime/index

export interface App {
  /**
   * [API Reference](https://nxs.li/docs/api/logger) ⌁ [Guide](https://nxs.li/docs/guides/logger) ⌁ [Issues](https://nxs.li/issues/components/logger)
   */
  log: Logger.Logger
  /**
   * [API Reference](https://nxs.li/docs/api/server) ⌁ [Guide](https://nxs.li/docs/guides/server) ⌁ [Issues](https://nxs.li/issues/components/server)
   */
  server: Server.Server
  /**
   * [API Reference](https://nxs.li/docs/api/schema) ⌁ [Guide](https://nxs.li/docs/guides/schema) ⌁ [Issues](https://nxs.li/issues/components/schema)
   */
  schema: Schema.Schema
  /**
   * [API Reference](https://nxs.li/docs/api/settings) ⌁ [Issues](https://nxs.li/issues/components/settings)
   */
  settings: Settings.Settings
  /**
   * [API Reference](https://nxs.li/docs/api/use-plugins) ⌁ [Issues](https://nxs.li/issues/components/plugins)
   */
  use(plugin: Plugin.Plugin): void
  /**
   * Run this to gather the final state of all Nexus api interactions. This method
   * is experimental. It provides experimental support for Nextjs integration.
   *
   * In a regular Nexus app, you should not need to use this method.
   *
   * @experimental
   */
  assemble(): any
  /**
   * This method makes it possible to reset the state of the singleton. This can
   * be useful when working in a development environment where multiple runs of
   * the app (or run-like, e.g. Node module cache being reset) can take place
   * without having state reset. Such an example of that is the Next.js dev
   * mode.
   *
   * @experimental
   */
  reset(): any
  /**
   * todo
   */
  start(): any
  /**
   * todo
   */
  stop(): any
  /**
   * todo
   */
}

export type AppState = {
  plugins: Plugin.Plugin[]
  /**
   * Once the app is started incremental component APIs can no longer be used. This
   * flag let's those APIs detect that they are being used after app start. Then
   * they can do something useful like tell the user about their mistake.
   */
  assembled: null | {
    settings: Settings.SettingsData
    schema: NexusSchema.core.NexusGraphQLSchema
    missingTypes: Index<NexusSchema.core.MissingType>
    loadedPlugins: RuntimeContributions<any>[]
    createContext: ContextCreator
  }
  running: boolean
  schemaComponent: Schema.LazyState
}

export type PrivateApp = App & {
  private: {
    state: AppState
  }
}

/**
 * Create new app state. Be careful to pass this state to components to complete its
 * data. The data returned only contains core state, despite what the return
 * type says.
 */
export function createAppState(): AppState {
  const appState = {
    assembled: null,
    running: false,
    plugins: [],
  } as Omit<AppState, 'schemaComponent'>

  return appState as any
}

/**
 * Create an app instance
 */
export function create(): App {
  const appState = createAppState()
  const serverComponent = Server.create(appState)
  const schemaComponent = Schema.create(appState)
  const settingsComponent = Settings.create(appState, {
    serverSettings: serverComponent.private.settings,
    schemaSettings: schemaComponent.private.settings,
    log: Logger.log,
  })

  const app: App = {
    log: log,
    settings: settingsComponent.public,
    schema: schemaComponent.public,
    server: serverComponent.public,
    reset() {
      // todo once we have log filtering, make this debug level
      rootLogger.trace('resetting state')
      schemaComponent.private.reset()
      serverComponent.private.reset()
      settingsComponent.private.reset()
      appState.assembled = null
      appState.plugins = []
      appState.running = false
    },
    assemble() {
      if (appState.assembled) return

      schemaComponent.private.beforeAssembly()

      /**
       * Plugin reflection is run in the same process (eval). This means if the
       * process is the app, which it is during testing for example, then we
       * need to take extreme care to not mark assembly as complete, during
       * plugin reflection. If we did, then, when we would try to start the app,
       * it would think it is already assembled. !
       */
      if (Reflection.isReflectionStage('plugin')) return

      appState.assembled = {} as AppState['assembled']

      const loadedPlugins = Plugin.importAndLoadRuntimePlugins(
        appState.plugins,
        appState.schemaComponent.scalars
      )
      appState.assembled!.loadedPlugins = loadedPlugins

      const { schema, missingTypes } = schemaComponent.private.assemble(loadedPlugins)
      appState.assembled!.schema = schema
      appState.assembled!.missingTypes = missingTypes

      if (Reflection.isReflectionStage('typegen')) return

      const { createContext } = serverComponent.private.assemble(loadedPlugins, schema)
      appState.assembled!.createContext = createContext

      const { settings } = settingsComponent.private.assemble()
      appState.assembled!.settings = settings

      schemaComponent.private.checks()
    },
    async start() {
      if (Reflection.isReflection()) return
      if (appState.running) return
      await serverComponent.private.start()
      appState.running = true
    },
    async stop() {
      if (Reflection.isReflection()) return
      if (!appState.running) return
      await serverComponent.private.stop()
      appState.running = false
    },
    use(plugin) {
      assertAppNotAssembled(appState, 'app.use', 'The plugin you attempted to use will be ignored')
      appState.plugins.push(plugin)
    },
  }

  /**
   * Setup default log filter
   */
  app.settings.change({
    logger: {
      filter: 'app:*, nexus:*@info+, *@warn+',
    },
  })

  /**
   * Setup default scalar types
   */
  app.schema.importType(builtinScalars.Date, 'date')
  app.schema.importType(builtinScalars.Json, 'json')

  return {
    ...app,
    private: {
      state: appState,
    },
  } as App
}
