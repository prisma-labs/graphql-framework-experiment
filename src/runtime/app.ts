import * as Logger from '@nexus/logger'
import { NexusGraphQLSchema } from '@nexus/schema/dist/core'
import { stripIndent } from 'common-tags'
import * as Plugin from '../lib/plugin'
import { RuntimeContributions } from '../lib/plugin'
import * as Reflection from '../lib/reflection'
import * as Schema from './schema'
import * as Server from './server'
import { ContextCreator } from './server/server'
import * as Settings from './settings'

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
  settings: Settings.Settings
  /**
   * [API Reference](https://www.nexusjs.org/#/api/modules/main/exports/schema) // [Guide](todo)
   *
   * ### todo
   */
  schema: Schema.Schema
  /**
   * todo
   */
  use(plugin: Plugin.Plugin): void
  /**
   * todo
   */
  assemble(): any
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
  // schema: () => NexusSchema.core.NexusGraphQLSchema
  /**
   * Once the app is started incremental component APIs can no longer be used. This
   * flag let's those APIs detect that they are being used after app start. Then
   * they can do something useful like tell the user about their mistake.
   */
  assembled: null | {
    schema: NexusGraphQLSchema
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
  const settingsComponent = Settings.create({
    serverSettings: serverComponent.private.settings,
    schemaSettings: schemaComponent.private.settings,
    log,
  })
  const api: PrivteApp = {
    log: log,
    settings: settingsComponent.public,
    schema: schemaComponent.public,
    server: serverComponent.public,
    assemble() {
      if (appState.assembled) return

      appState.assembled = {} as any

      if (Reflection.isReflectionStage('plugin')) return

      const loadedPlugins = Plugin.importAndLoadRuntimePlugins(appState.plugins)

      const { schema } = schemaComponent.private.assemble(loadedPlugins)

      if (Reflection.isReflectionStage('typegen')) return

      const { createContext } = serverComponent.private.assemble(
        loadedPlugins,
        appState.schemaComponent.schema!
      )

      schemaComponent.private.checks()

      appState.assembled = {
        loadedPlugins,
        schema,
        createContext,
      }
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
      // extract util assertion
      if (appState.assembled) {
        log.warn(stripIndent`
          A plugin was ignored because it was loaded after the server was started
          Make sure to call \`use\` before you call \`app.assemble\`
        `)
      }
      appState.plugins.push(plugin)
    },
    private: {
      state: appState,
    },
  }

  return api
}
