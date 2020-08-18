import * as Logger from '@nexus/logger'
import * as NexusSchema from '@nexus/schema'
import { rootLogger } from '../lib/nexus-logger'
import * as Plugin from '../lib/plugin'
import { RuntimeContributions } from '../lib/plugin'
import * as Reflection from '../lib/reflection/stage'
import { builtinScalars } from '../lib/scalars'
import { Index } from '../lib/utils'
import * as Lifecycle from './lifecycle'
import * as Schema from './schema'
import * as Server from './server'
import * as Settings from './settings'
import { assertAppNotAssembled } from './utils'

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
   * [API Reference](https://nxs.li/docs/api/on) ⌁ [Issues](https://nxs.li/issues/components/lifecycle)
   *
   * Use the lifecycle component to tap into application events.
   */
  on: Lifecycle.Lifecycle
  /**
   * [API Reference](https://nxs.li/docs/api/use-plugins) ⌁ [Issues](https://nxs.li/issues/components/plugins)
   */
  use(plugin: Plugin.Plugin): void
  /**
   * Run this to gather the final state of all Nexus api interactions. This method
   * is experimental. It provides experimental support for NextJS integration.
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
    createContext: Schema.ContextAdder
  }
  running: boolean
  components: {
    schema: Schema.LazyState
    lifecycle: Lifecycle.LazyState
  }
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
  const appState: AppState = {
    assembled: null,
    running: false,
    plugins: [],
    components: {} as any, // populated by components
  }

  return appState
}

/**
 * Create an app instance
 */
export function create(): App {
  const state = createAppState()
  const serverComponent = Server.create(state)
  const schemaComponent = Schema.create(state)
  const settingsComponent = Settings.create(state, {
    serverSettings: serverComponent.private.settings,
    schemaSettings: schemaComponent.private.settings,
    log: Logger.log,
  })
  const lifecycleComponent = Lifecycle.create(state)

  const app: App = {
    log: log,
    settings: settingsComponent.public,
    schema: schemaComponent.public,
    server: serverComponent.public,
    on: lifecycleComponent.public,
    reset() {
      rootLogger.debug('resetting state')
      schemaComponent.private.reset()
      serverComponent.private.reset()
      settingsComponent.private.reset()
      lifecycleComponent.private.reset()
      state.assembled = null
      state.plugins = []
      state.running = false
      dogfood()
    },
    async start() {
      if (Reflection.isReflection()) return
      if (state.running) return
      if (!state.assembled) {
        throw new Error('Must call app.assemble before calling app.start')
      }
      lifecycleComponent.private.trigger.start({
        schema: state.assembled!.schema,
      })
      await serverComponent.private.start()
      state.running = true
    },
    async stop() {
      if (Reflection.isReflection()) return
      if (!state.running) return
      await serverComponent.private.stop()
      state.running = false
    },
    use(plugin) {
      assertAppNotAssembled(state, 'app.use', 'The plugin you attempted to use will be ignored')
      state.plugins.push(plugin)
    },
    assemble() {
      if (state.assembled) return

      schemaComponent.private.beforeAssembly()

      /**
       * Plugin reflection is run in the same process (eval). This means if the
       * process is the app, which it is during testing for example, then we
       * need to take extreme care to not mark assembly as complete, during
       * plugin reflection. If we did, then, when we would try to start the app,
       * it would think it is already assembled. !
       */
      if (Reflection.isReflectionStage('plugin')) return

      state.assembled = {} as AppState['assembled']

      const loadedPlugins = Plugin.importAndLoadRuntimePlugins(state.plugins, state.components.schema.scalars)
      state.assembled!.loadedPlugins = loadedPlugins

      const { schema, missingTypes } = schemaComponent.private.assemble(loadedPlugins)
      state.assembled!.schema = schema
      state.assembled!.missingTypes = missingTypes

      if (Reflection.isReflectionStage('typegen')) return

      const { createContext } = serverComponent.private.assemble(loadedPlugins, schema)
      state.assembled!.createContext = createContext

      const { settings } = settingsComponent.private.assemble()
      state.assembled!.settings = settings

      schemaComponent.private.checks()
    },
  }

  /**
   * Dogfood the public API to change things.
   */
  function dogfood() {
    /**
     * Setup default log filter
     */
    app.settings.change({
      logger: {
        filter: 'app:*, nexus:*@info+, *@warn+',
        pretty: { timeDiff: false },
      },
    })

    /**
     * Setup default scalar types
     */
    app.schema.importType(builtinScalars.DateTime, 'date')
    app.schema.importType(builtinScalars.Json, 'json')

    /**
     * Add `req` and `res` to the context by default
     */
    app.schema.addToContext((params) => params)
  }

  // HACK dogfood function called eagerly here once and
  // then within reset method. We should have a better
  // reset system.

  dogfood()

  return {
    ...app,
    private: {
      state: state,
    },
  } as App
}
