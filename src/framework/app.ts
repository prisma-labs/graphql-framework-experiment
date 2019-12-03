import { ApolloServer } from 'apollo-server-express'
import express from 'express'
import * as fs from 'fs-jetpack'
import * as nexus from 'nexus'
import { requireSchemaModules, pog, findFile, stripExt } from '../utils'
import { createNexusSingleton, createNexusConfig } from './nexus'
import { Plugin } from './plugin'
import { createPrismaPlugin, isPrismaEnabledSync } from './plugins'
import { stripIndent, stripIndents } from 'common-tags'
import { sendServerReadySignalToDevModeMaster } from './dev-mode'

const log = pog.sub(__filename)

type ServerOptions = {
  port?: number
  startMessage?: (port: number) => string
  playground?: boolean
  introspection?: boolean
}

const serverStartMessage = (port: number): string => {
  return stripIndent`
    Your GraphQL API is now ready

    GraphQL Playground: http://localhost:${port}/graphql
  `
}

const defaultServerOptions: Required<ServerOptions> = {
  port: 4000,
  startMessage: serverStartMessage,
  introspection: true,
  playground: true,
}

// TODO plugins could augment the request
// plugins will be able to use typegen to signal this fact
// all places in the framework where the req object is referenced should be
// actually referencing the typegen version, so that it reflects the req +
// plugin augmentations type
type ContextContributor<T extends {}> = (req: Express.Request) => T

export type App = {
  use: (plugin: Plugin<any>) => App
  addContext: <T extends {}>(contextContributor: ContextContributor<T>) => App
  // installGlobally: () => App
  server: {
    start: (config?: ServerOptions) => Promise<void>
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

  const plugins: Plugin[] = []

  const contextContributors: ContextContributor<any>[] = []

  const api: App = {
    // TODO bring this back pending future discussion
    // installGlobally() {
    //   installGlobally(api)
    //   return api
    // },
    use(plugin) {
      plugins.push(plugin)
      return api
    },
    addContext(contextContributor) {
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
      async start(config: ServerOptions = {}): Promise<void> {
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
        if (process.env.PUMPKINS_STAGE === 'dev') {
          requireSchemaModules()
        }

        const mergedConfig: Required<ServerOptions> = {
          ...defaultServerOptions,
          ...config,
        }

        // Create the Nexus config
        const nexusConfig = createNexusConfig()

        // Get the context module for the app.
        // User can provide a context module at a conventional path.
        // Otherwise we will provide a default context module.
        //
        // TODO context module should have flexible contract
        //      currently MUST return a createContext function
        const contextPath = findFile('context.ts')

        if (contextPath) {
          nexusConfig.typegenAutoConfig!.contextType = 'Context.Context'
          nexusConfig.typegenAutoConfig!.sources.push({
            source: contextPath,
            alias: 'Context',
          })
        }

        const typegenAutoConfigObject = nexusConfig.typegenAutoConfig!
        nexusConfig.typegenAutoConfig = undefined

        // Our use-case of multiple context sources seems to require a custom
        // handling of typegenConfig. Opened an issue about maybe making our
        // curreent use-case, fairly basic, integrated into the auto system, here:
        // https://github.com/prisma-labs/nexus/issues/323
        nexusConfig.typegenConfig = async (schema, outputPath) => {
          const configurator = await nexus.core.typegenAutoConfig(
            typegenAutoConfigObject
          )
          const config = await configurator(schema, outputPath)

          // Initialize
          config.imports.push('interface Context {}')
          config.contextType = 'Context'

          // Integrate the addContext calls
          const addContextCallResults: string[] = process.env
            .PUMPKINS_TYPEGEN_ADD_CONTEXT_RESULTS
            ? JSON.parse(process.env.PUMPKINS_TYPEGEN_ADD_CONTEXT_RESULTS)
            : []

          const typeDec = addContextCallResults
            .map(result => {
              return stripIndents`
                interface Context ${result}
              `
            })
            .join('\n\n')

          config.imports.push(typeDec)

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

            const typeDec = stripIndents`
              interface Context {
                ${Object.entries(p.context.typeGen.fields)
                  .map(([name, type]) => {
                    return `${name}: ${type}`
                  })
                  .join('\n')}
              }
            `

            config.imports.push(typeDec)
          }

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
        const server = new ApolloServer({
          playground: mergedConfig.playground,
          introspection: mergedConfig.introspection,
          // TODO Idea: context that provides an eager object can be hoisted out
          // of the func to improve performance.
          context: req => {
            const ctx = {}

            // Integrate context from plugins
            for (const plugin of plugins) {
              if (!plugin.context) continue
              const contextContribution = plugin.context.create(req)
              Object.assign(ctx, contextContribution)
            }

            // Integrate context from app
            if (contextPath) {
              // TODO good feedback to user if something goes wrong
              Object.assign(ctx, require(contextPath).createContext(req))
            }

            // Integrate context from app context api
            // TODO support async; probably always supported by apollo server
            // TODO good runtime feedback to user if something goes wrong
            //
            for (const contextContributor of contextContributors) {
              Object.assign(ctx, contextContributor(req))
            }

            return ctx
          },
          schema,
        })

        const app = express()

        server.applyMiddleware({ app })

        app.listen({ port: mergedConfig.port }, () =>
          console.log(mergedConfig.startMessage(mergedConfig.port))
        )

        sendServerReadySignalToDevModeMaster()
      },
    },
  }

  if (isPrismaEnabledSync().enabled) {
    log(
      'enabling prisma plugin because detected prisma framework is being used on this project'
    )
    api.use(createPrismaPlugin())
  } else {
    log(
      'disabling prisma plugin because detected prisma framework not being used on this project'
    )
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

  const pumpkinsTypeGenPath = 'node_modules/@types/typegen-pumpkins/index.d.ts'
  log('generating app global singleton typegen to %s', pumpkinsTypeGenPath)

  fs.write(
    pumpkinsTypeGenPath,
    stripIndent`
      import * as nexus from 'nexus'
      import * as pumpkins from 'pumpkins'

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
        var app: pumpkins.App
        var queryType: QueryType
        var mutationType: MutationType
        var objectType: ObjectType
        var inputObjectType: InputObjectType
        var enumType: EnumType
        var scalarType: ScalarType
        var unionType: UnionType
        var intArg: IntArg
        var stringArg: StringArg

        interface PumpkinsSingletonApp extends pumpkins.App {}
      
        namespace NodeJS {
          interface Global {
            app: pumpkins.App
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
  return packageJson?.pumpkins?.singleton !== false
}
