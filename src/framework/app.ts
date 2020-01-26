import { stripIndent, stripIndents } from 'common-tags'
import * as fs from 'fs-jetpack'
import * as nexus from 'nexus'
import { typegenAutoConfig } from 'nexus/dist/core'
import * as Logger from '../lib/logger'
import { pog, requireSchemaModules } from '../utils'
import { createNexusConfig, createNexusSingleton } from './nexus'
import * as Plugin from '../core/plugin'
import * as singletonChecks from './singleton-checks'
import * as HTTP from 'http'
import * as Lo from 'lodash'
import * as Server from './server'

const log = pog.sub(__filename)
const logger = Logger.create({ name: 'app' })

/**
 * The available server options to configure how your app runs its server.
 */
type ServerOptions = Partial<
  Pick<Server.Options, 'port' | 'playground' | 'startMessage'>
>

type Request = HTTP.IncomingMessage & { logger: Logger.Logger }

// TODO plugins could augment the request
// plugins will be able to use typegen to signal this fact
// all places in the framework where the req object is referenced should be
// actually referencing the typegen version, so that it reflects the req +
// plugin augmentations type
type ContextContributor<T extends {}> = (req: Request) => T

export type App = {
  use: (plugin: Plugin.Driver) => App
  logger: Logger.RootLogger
  addToContext: <T extends {}>(contextContributor: ContextContributor<T>) => App
  // installGlobally: () => App
  server: {
    start: (config?: ServerOptions) => Promise<void>
    stop: () => Promise<void>
  }
  queryType: typeof nexus.queryType
  mutationType: typeof nexus.mutationType
  objectType: typeof nexus.objectType
  inputObjectType: typeof nexus.inputObjectType
  enumType: typeof nexus.enumType
  scalarType: typeof nexus.scalarType
  unionType: typeof nexus.unionType
  interfaceType: typeof nexus.interfaceType
  intArg: typeof nexus.intArg
  stringArg: typeof nexus.stringArg
  booleanArg: typeof nexus.booleanArg
  floatArg: typeof nexus.floatArg
  idArg: typeof nexus.idArg
  extendType: typeof nexus.extendType
  extendInputType: typeof nexus.extendInputType
}

/**
 * Crate an app instance
 * TODO extract and improve config type
 */
export function createApp(appConfig?: { types?: any }): App {
  const {
    queryType,
    mutationType,
    objectType,
    inputObjectType,
    enumType,
    scalarType,
    unionType,
    interfaceType,
    intArg,
    stringArg,
    booleanArg,
    floatArg,
    idArg,
    extendType,
    extendInputType,
    makeSchema,
  } = createNexusSingleton()

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
  const api: App = {
    logger,
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
    addToContext(contextContributor) {
      contextContributors.push(contextContributor)
      return api
    },
    queryType,
    mutationType,
    objectType,
    inputObjectType,
    enumType,
    scalarType,
    unionType,
    interfaceType,
    intArg,
    stringArg,
    booleanArg,
    floatArg,
    idArg,
    extendType,
    extendInputType,
    server: {
      /**
       * Start the server. If you do not call this explicitly then graphql-santa will
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
        if (process.env.GRAPHQL_SANTA_STAGE === 'dev') {
          requireSchemaModules()
        }

        // Create the Nexus config
        const nexusConfig = createNexusConfig()

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
            .GRAPHQL_SANTA_TYPEGEN_ADD_CONTEXT_RESULTS
            ? JSON.parse(process.env.GRAPHQL_SANTA_TYPEGEN_ADD_CONTEXT_RESULTS)
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
            "import * as Logger from 'graphql-santa/dist/lib/logger'",
            contextTypeContribSpecToCode({
              logger: 'Logger.Logger',
            })
          )

          api.logger.trace('built up Nexus typegenConfig', { config })
          return config
        }

        pog('built up Nexus config: %O', nexusConfig)

        // Merge the plugin nexus plugins
        nexusConfig.plugins = nexusConfig.plugins ?? []
        for (const plugin of plugins) {
          nexusConfig.plugins.push(...(plugin.nexus?.plugins ?? []))
        }

        if (appConfig?.types && appConfig.types.length !== 0) {
          nexusConfig.types.push(...appConfig.types)
        }

        return Server.create({
          schema: await makeSchema(nexusConfig),
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

/**
 * Augment global scope with a given app singleton.
 */
const installGlobally = (app: App): App => {
  log('exposing app global')

  const {
    queryType,
    mutationType,
    objectType,
    inputObjectType,
    enumType,
    scalarType,
    unionType,
    intArg,
    stringArg,
    //TODO rest of the statics...
  } = app

  Object.assign(global, {
    app,
    queryType,
    mutationType,
    objectType,
    inputObjectType,
    enumType,
    scalarType,
    unionType,
    intArg,
    stringArg,
  })

  const graphqlSantaTypeGenPath =
    'node_modules/@types/typegen-graphql-santa/index.d.ts'
  log('generating app global singleton typegen to %s', graphqlSantaTypeGenPath)

  fs.write(
    graphqlSantaTypeGenPath,
    stripIndent`
      import * as nexus from 'nexus'
      import * as GQLSanta from 'graphql-santa'

      type QueryType = typeof nexus.core.queryType
      type MutationType = typeof nexus.core.mutationType
      type ObjectType = typeof nexus.objectType
      type InputObjectType = typeof nexus.inputObjectType
      type EnumType = typeof nexus.enumType
      type ScalarType = typeof nexus.scalarType
      type UnionType = typeof nexus.unionType
      type IntArg = typeof nexus.intArg
      type StringArg = typeof nexus.stringArg
      
      declare global {
        var app: GQLSanta.App
        var queryType: QueryType
        var mutationType: MutationType
        var objectType: ObjectType
        var inputObjectType: InputObjectType
        var enumType: EnumType
        var scalarType: ScalarType
        var unionType: UnionType
        var intArg: IntArg
        var stringArg: StringArg

        interface GQLSantaSingletonApp extends GQLSanta.App {}
      
        namespace NodeJS {
          interface Global {
            app: GQLSanta.App
            queryType: QueryType
            mutationType: MutationType
            objectType: ObjectType
            inputObjectType: InputObjectType
            enumType: EnumType
            scalarType: ScalarType
            unionType: UnionType
            intArg: IntArg
            stringArg: StringArg
          }
        }
      }
    `
  )

  return app
}

export const isGlobalSingletonEnabled = (): boolean => {
  const packageJson = fs.read('package.json', 'json')
  return packageJson?.['graphql-santa']?.singleton !== false
}
