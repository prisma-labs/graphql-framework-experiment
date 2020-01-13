import { ApolloServer } from 'apollo-server-express'
import { stripIndent, stripIndents } from 'common-tags'
import express from 'express'
import * as fs from 'fs-jetpack'
import { Server } from 'http'
import * as nexus from 'nexus'
import { typegenAutoConfig } from 'nexus/dist/core'
import * as Logger from '../lib/logger'
import { pog, requireSchemaModules } from '../utils'
import { sendServerReadySignalToDevModeMaster } from './dev-mode'
import { createNexusConfig, createNexusSingleton } from './nexus'
import * as Plugin from './plugin'
import * as singletonChecks from './singleton-checks'

const log = pog.sub(__filename)
const logger = Logger.create({ name: 'app' })
const serverLogger = logger.child('server')

/**
 * The available server options to configure how your app runs its server.
 */
type ServerOptions = {
  port?: number
  startMessage?: (port: number) => void
  playground?: boolean
  introspection?: boolean
}

/**
 * Create a message suitable for printing to the terminal about the server
 * having been booted.
 */
const serverStartMessage = (port: number): void => {
  serverLogger.info('listening', {
    host: 'localhost',
    port,
  })
}

/**
 * The default server options. These are merged with whatever you provide. Your
 * settings take precedence over these.
 */
const defaultServerOptions: Required<ServerOptions> = {
  port:
    typeof process.env.GRAPHQL_SANTA_PORT === 'string'
      ? parseInt(process.env.GRAPHQL_SANTA_PORT, 10)
      : typeof process.env.PORT === 'string'
      ? // e.g. Heroku convention https://stackoverflow.com/questions/28706180/setting-the-port-for-node-js-server-on-heroku
        parseInt(process.env.PORT, 10)
      : process.env.NODE_ENV === 'production'
      ? 80
      : 4000,
  startMessage: serverStartMessage,
  introspection: true,
  playground: true,
}

type Request = Express.Request & { logger: Logger.Logger }

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
  intArg: typeof nexus.intArg
  stringArg: typeof nexus.stringArg
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
    intArg,
    stringArg,
    makeSchema,
  } = createNexusSingleton()

  const plugins: Plugin.RuntimeContributions[] = []

  // Automatically use all installed plugins
  // TODO during build step we should turn this into static imports, not unlike
  // the schema module imports system.
  plugins.push(...Plugin.loadAllRuntimePluginsFromPackageJsonSync())

  const contextContributors: ContextContributor<any>[] = []

  let httpServer: Server | null = null
  let apolloServer: ApolloServer | null = null
  let serverRunning = false

  /**
   * Auto-use all runtime plugins that are installed in the project
   */

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
    intArg,
    stringArg,
    server: {
      /**
       * Start the server. If you do not call this explicitly then graphql-santa will
       * for you. You should not normally need to call this function yourself.
       */
      async start(config: ServerOptions = {}): Promise<void> {
        if (serverRunning) {
          return serverLogger.error(
            'server.start invoked but server is already currently running'
          )
        }

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

        const mergedConfig: Required<ServerOptions> = {
          ...defaultServerOptions,
          ...config,
        }

        // Create the Nexus config
        const nexusConfig = createNexusConfig()

        const typegenAutoConfigObject = nexusConfig.typegenAutoConfig!
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

          pog('built up Nexus typegenConfig: %O', config)
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

        const schema = await makeSchema(nexusConfig)
        apolloServer = new ApolloServer({
          playground: mergedConfig.playground,
          introspection: mergedConfig.introspection,
          // TODO Idea: context that provides an eager object can be hoisted out
          // of the func to improve performance.
          context: req => {
            // TODO HACK
            ;(req as any).logger = logger.child('request')
            const ctx = {}

            // Integrate context from plugins
            for (const plugin of plugins) {
              if (!plugin.context) continue
              const contextContribution = plugin.context.create(req)
              Object.assign(ctx, contextContribution)
            }

            // Integrate context from app context api
            // TODO support async; probably always supported by apollo server
            // TODO good runtime feedback to user if something goes wrong
            //
            for (const contextContributor of contextContributors) {
              // HACK see req mutation at this func body start
              Object.assign(ctx, {
                ...contextContributor((req as unknown) as Request),
                logger: ((req as unknown) as Request).logger,
              })
            }

            return ctx
          },
          schema,
        })

        const expressApp = express()
        apolloServer.applyMiddleware({ app: expressApp })

        return new Promise(resolve => {
          const server = expressApp.listen(mergedConfig.port, () => {
            mergedConfig.startMessage(mergedConfig.port)

            serverRunning = true
            httpServer = server
            sendServerReadySignalToDevModeMaster()

            return resolve()
          })
        })
      },
      async stop() {
        if (!serverRunning) {
          return serverLogger.warn(
            'server.stop invoked but not currently running'
          )
        }

        await apolloServer?.stop()
        await httpServer?.close()
        serverRunning = false
      },
    },
  }

  // // TODO find different heurisitc for this, prisma will be formally extracted
  // // from  core...
  // if (fs.find('prisma', { matching: 'schema.prisma' })) {
  //   log(
  //     'enabling prisma plugin because detected prisma framework is being used on this project'
  //   )
  //   api.use(PrismaPlugin.create)
  // } else {
  //   log(
  //     'disabling prisma plugin because detected prisma framework not being used on this project'
  //   )
  // }

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
