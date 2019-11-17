import { ApolloServer } from 'apollo-server-express'
import express from 'express'
import * as fs from 'fs-jetpack'
import * as nexus from 'nexus'
import {
  findOrScaffold,
  requireSchemaModules,
  createNexusConfig,
  log,
  trimExt,
  pumpkinsPath,
} from '../utils'
import { createNexusSingleton } from './nexus'
import { typegenAutoConfig } from 'nexus/dist/core'
import { Plugin } from './plugin'
import { createPrismaPlugin, isPrismaEnabledSync } from './plugins'
import { stripIndent } from 'common-tags'

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
 */
export function createApp(): App {
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

        // Get the context module for the app.
        // User can provide a context module at a conventional path.
        // Otherwise we will provide a default context module.
        //
        // TODO context module should have flexible contract
        //      currently MUST return a createContext function
        const contextPath = findOrScaffold({
          fileNames: ['context.ts'],
          fallbackPath: pumpkinsPath('context.ts'),
          fallbackContent: stripIndent`
          export type Context = {}
                
          export function createContext(): Context {
            return {}
          }
        `,
        })

        const context = require(contextPath)

        const mergedConfig: Required<ServerOptions> = {
          ...defaultServerOptions,
          ...config,
        }

        const nexusConfig = createNexusConfig({
          generatedPhotonPackagePath,
          contextPath,
        })

        const autoConfig = nexusConfig.typegenAutoConfig ?? {
          sources: [],
        }
        nexusConfig.typegenAutoConfig = undefined

        // Our use-case of multiple context sources seems to require a custom
        // handling of typegenConfig. Opened an issue about maybe making our
        // curreent use-case, fairly basic, integrated into the auto system, here:
        // https://github.com/prisma-labs/nexus/issues/323
        nexusConfig.typegenConfig = async (schema, outputPath) => {
          const configurator = await typegenAutoConfig(autoConfig)
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
            config.contextType = `${config.contextType} & ${alias}.${typeExportName}`
          }

          log('built up Nexus typegenConfig: %O', config)

          return config
        }

        // Merge the plugin nexus plugins
        nexusConfig.plugins = nexusConfig.plugins ?? []
        for (const plugin of plugins) {
          nexusConfig.plugins.push(...(plugin.nexus?.plugins ?? []))
        }

        const schema = await makeSchema(nexusConfig)
        const server = new ApolloServer({
          playground: mergedConfig.playground,
          introspection: mergedConfig.introspection,
          context: req => {
            const ctx = {}
            for (const plugin of plugins) {
              if (!plugin.context) continue
              Object.assign(plugin.context.create(req))
            }
            Object.assign(ctx, context.createContext(req))
            return ctx
          },
          schema,
        })

        const app = express()

        server.applyMiddleware({ app })

        app.listen({ port: mergedConfig.port }, () =>
          console.log(mergedConfig.startMessage(mergedConfig.port))
        )
      },
    },
  }

  if (isPrismaEnabledSync().enabled) {
    log.app(
      'enabling prisma plugin because detected prisma framework is being used on this project'
    )
    api.use(createPrismaPlugin())
  } else {
    log.app(
      'disabling prisma plugin because detected prisma framework not being used on this project'
    )
  }

  return api
}

/**
 * Augment global scope with a given app singleton.
 */
const installGlobally = (app: App): App => {
  log.app('exposing app global')

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
  log.app('generating app global singleton typegen to %s', pumpkinsTypeGenPath)

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
        var app: App
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
            app: App
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
  return true
}
