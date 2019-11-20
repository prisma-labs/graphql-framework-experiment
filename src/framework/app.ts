import { ApolloServer } from 'apollo-server-express'
import express from 'express'
import * as fs from 'fs-jetpack'
import * as nexus from 'nexus'
import {
  requireSchemaModules,
  createNexusConfig,
  pog,
  trimExt,
  findFile,
} from '../utils'
import { createNexusSingleton } from './nexus'
import { typegenAutoConfig } from 'nexus/dist/core'
import { Plugin } from './plugin'
import { createPrismaPlugin, isPrismaEnabledSync } from './plugins'
import { stripIndent } from 'common-tags'

const log = pog.sub(__filename)

type ServerOptions = {
  port?: number
  startMessage?: (port: number) => string
  playground?: boolean
  introspection?: boolean
}

const defaultServerOptions: Required<ServerOptions> = {
  port: 4000,
  startMessage: port => `🎃  Server ready at http://localhost:${port}/`,
  introspection: true,
  playground: true,
}

export type App = {
  use: (plugin: Plugin<any>) => App
  installGlobally: () => App
  server: {
    start: (config?: ServerOptions) => Promise<void>
  }
  schema: {
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

  const api: App = {
    installGlobally() {
      installGlobally(api)
      return api
    },
    use(plugin) {
      plugins.push(plugin)
      return api
    },
    schema: {
      queryType,
      mutationType,
      objectType,
      inputObjectType,
      enumType,
      scalarType,
      unionType,
      intArg,
      stringArg,
    },
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

        // This code MUST run after user/system has had chance to run global installation
        requireSchemaModules()

        const generatedPhotonPackagePath = fs.path(
          'node_modules/@generated/photon'
        )

        const mergedConfig: Required<ServerOptions> = {
          ...defaultServerOptions,
          ...config,
        }

        // Create the Nexus config
        const nexusConfig = createNexusConfig({
          generatedPhotonPackagePath,
        })

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
          const configurator = await typegenAutoConfig(typegenAutoConfigObject)
          const config = await configurator(schema, outputPath)

          for (const p of plugins) {
            if (!p.context) continue

            // TODO validate that the plugin context source actually exports the type it pupports to
            // TODO pascal case
            const alias = `ContextFrom${p.name}`
            const typeExportName = p.context.typeExportName ?? 'Context'
            config.imports.push(
              `import * as ${alias} from "${trimExt(
                p.context.typeSourcePath,
                '.ts'
              )}"`
            )
            config.contextType =
              config.contextType === undefined
                ? `${alias}.${typeExportName}`
                : `${config.contextType} & ${alias}.${typeExportName}`
          }

          pog('built up Nexus typegenConfig: %O', config)

          return config
        }

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

            return ctx
          },
          schema,
        })

        const app = express()

        server.applyMiddleware({ app })

        app.listen({ port: mergedConfig.port }, () =>
          console.log(mergedConfig.startMessage(mergedConfig.port))
        )

        process.send!({ ready: true, cmd: 'NODE_DEV' })
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
  } = app.schema

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
