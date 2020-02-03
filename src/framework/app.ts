import { typegenAutoConfig } from '@nexus/schema/dist/core'
import { stripIndents } from 'common-tags'
import * as HTTP from 'http'
import * as Lo from 'lodash'
import * as Plugin from '../core/plugin'
import * as Logger from '../lib/logger'
import * as Schema from './schema'
import * as Server from './server'
import * as singletonChecks from './singleton-checks'

const log = Logger.create({ name: 'app' })

/**
 * The available server options to configure how your app runs its server.
 */
type ServerOptions = Partial<
  Pick<Server.Options, 'port' | 'playground' | 'startMessage'>
>

type Request = HTTP.IncomingMessage & { log: Logger.Logger }

// TODO plugins could augment the request
// plugins will be able to use typegen to signal this fact
// all places in the framework where the req object is referenced should be
// actually referencing the typegen version, so that it reflects the req +
// plugin augmentations type
type ContextContributor<T extends {}> = (req: Request) => T

export type App = {
  use: (plugin: Plugin.Driver) => App
  /**
   * [API Reference](https://nexus-future.now.sh/#/references/api?id=logger)  ⌁  [Guide](https://nexus-future.now.sh/#/guides/logging)
   *
   * ### todo
   */
  log: Logger.RootLogger
  /**
   * [API Reference](https://nexus-future.now.sh/#/references/api?id=server)  ⌁  [Guide](todo)
   *
   * ### todo
   *
   */
  server: {
    start: (config?: ServerOptions) => Promise<void>
    stop: () => Promise<void>
  }
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

/**
 * Crate an app instance
 * TODO extract and improve config type
 */
export function create(appConfig?: { types?: any }): App {
  const plugins: Plugin.RuntimeContributions[] = []

  // Automatically use all installed plugins
  // TODO during build step we should turn this into static imports, not unlike
  // the schema module imports system.
  plugins.push(...Plugin.loadAllRuntimePluginsFromPackageJsonSync())

  const contextContributors: ContextContributor<any>[] = []

  /**
   * Auto-use all runtime plugins that are installed in the project
   */

  let server: Server.Server
  const schema = Schema.create()
  const api: App = {
    log,
    // TODO bring this back pending future discussion
    // installGlobally() {
    //   installGlobally(api)
    //   return api
    // },
    // TODO think hard about this api... When/why would it be used with auto-use
    // import system? "Inproject" plugins? What is the right place to expose
    // this? app.plugins.use() ?
    use(pluginDriver) {
      const plugin = pluginDriver.loadRuntimePlugin()
      if (plugin) {
        plugins.push(plugin)
      }
      return api
    },
    schema: {
      addToContext(contextContributor) {
        contextContributors.push(contextContributor)
        return api
      },
      ...schema.external,
    },
    server: {
      /**
       * Start the server. If you do not call this explicitly then nexus will
       * for you. You should not normally need to call this function yourself.
       */
      async start(opts: ServerOptions = {}): Promise<void> {
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

        // todo refactor; this is from before when nexus and framework were
        // different (e.g. santa). Encapsulate component schema config
        // into framework schema module.
        //
        // Create the NexusSchema config
        const nexusConfig = Schema.createInternalConfig()

        // Integrate plugin typegenAutoConfig contributions
        const typegenAutoConfigFromPlugins = {}
        for (const p of plugins) {
          if (p.nexus?.typegenAutoConfig) {
            Lo.merge(typegenAutoConfigFromPlugins, p.nexus.typegenAutoConfig)
          }
        }

        const typegenAutoConfigObject = Lo.merge(
          {},
          typegenAutoConfigFromPlugins,
          nexusConfig.typegenAutoConfig!
        )
        nexusConfig.typegenAutoConfig = undefined

        function contextTypeContribSpecToCode(
          ctxTypeContribSpec: Record<string, string>
        ): string {
          return stripIndents`
              interface Context {
                ${Object.entries(ctxTypeContribSpec)
                  .map(([name, type]) => {
                    // Quote key name to handle case of identifier-incompatible key names
                    return `'${name}': ${type}`
                  })
                  .join('\n')}
              }
            `
        }

        // Our use-case of multiple context sources seems to require a custom
        // handling of typegenConfig. Opened an issue about maybe making our
        // curreent use-case, fairly basic, integrated into the auto system, here:
        // https://github.com/prisma-labs/nexus/issues/323
        nexusConfig.typegenConfig = async (schema, outputPath) => {
          const configurator = await typegenAutoConfig(typegenAutoConfigObject)
          const config = await configurator(schema, outputPath)

          // Initialize
          config.imports.push('interface Context {}')
          config.contextType = 'Context'

          // Integrate user's app calls to app.addToContext
          const addToContextCallResults: string[] = process.env
            .NEXUS_TYPEGEN_ADD_CONTEXT_RESULTS
            ? JSON.parse(process.env.NEXUS_TYPEGEN_ADD_CONTEXT_RESULTS)
            : []

          const addToContextInterfaces = addToContextCallResults
            .map(result => {
              return stripIndents`
                interface Context ${result}
              `
            })
            .join('\n\n')

          config.imports.push(addToContextInterfaces)

          // Integrate plugin context contributions
          for (const p of plugins) {
            if (!p.context) continue

            if (p.context.typeGen.imports) {
              config.imports.push(
                ...p.context.typeGen.imports.map(
                  im => `import * as ${im.as} from '${im.from}'`
                )
              )
            }

            config.imports.push(
              contextTypeContribSpecToCode(p.context.typeGen.fields)
            )
          }

          config.imports.push(
            "import * as Logger from 'nexus-future/dist/lib/logger'",
            contextTypeContribSpecToCode({
              log: 'Logger.Logger',
            })
          )

          api.log.trace('built up Nexus typegenConfig', { config })
          return config
        }

        log.trace('built up schema config', { nexusConfig })

        // Merge the plugin nexus plugins
        nexusConfig.plugins = nexusConfig.plugins ?? []
        for (const plugin of plugins) {
          nexusConfig.plugins.push(...(plugin.nexus?.plugins ?? []))
        }

        if (appConfig?.types && appConfig.types.length !== 0) {
          nexusConfig.types.push(...appConfig.types)
        }

        if (schema.internal.types.length === 0) {
          log.warn(
            'Your GraphQL schema is empty. Make sure your GraphQL schema lives in a `schema.ts` file or some `schema/` directories'
          )
        }

        return Server.create({
          schema: await schema.internal.compile(nexusConfig),
          plugins,
          contextContributors,
          ...opts,
        }).start()
      },
      async stop() {
        server?.stop
      },
    },
  }

  return api
}
