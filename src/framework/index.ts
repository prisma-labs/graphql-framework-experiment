import { ApolloServer } from 'apollo-server-express'
import express from 'express'
import * as fs from 'fs-jetpack'
import { intArg, stringArg } from 'nexus'
import { register } from 'ts-node'
import {
  findOrScaffold,
  requireSchemaModules,
  trimNodeModulesIfInPath,
  createNexusConfig,
  log,
  trimExt,
} from '../utils'
import { createNexusSingleton, MutationType, QueryType } from './nexus'
import { typegenAutoConfig } from 'nexus/dist/core'
import { Plugin } from './plugin'

/**
 * Use ts-node register to require .ts file and transpile them "on-the-fly"
 */
register({
  transpileOnly: true,
})

const {
  queryType,
  mutationType,
  objectType,
  inputObjectType,
  enumType,
  scalarType,
  unionType,
  makeSchema,
} = createNexusSingleton()

// agument global scope

type ObjectType = typeof objectType
type InputObjectType = typeof inputObjectType
type EnumType = typeof enumType
type ScalarType = typeof scalarType
type UnionType = typeof unionType
type IntArg = typeof intArg
type StringArg = typeof stringArg

global.queryType = queryType
global.mutationType = mutationType
global.objectType = objectType
global.inputObjectType = inputObjectType
global.enumType = enumType
global.scalarType = scalarType
global.unionType = unionType
global.intArg = intArg
global.stringArg = stringArg

declare global {
  var queryType: QueryType
  var mutationType: MutationType
  var objectType: ObjectType
  var inputObjectType: InputObjectType
  var enumType: EnumType
  var scalarType: ScalarType
  var unionType: UnionType
  var intArg: IntArg
  var stringArg: StringArg

  namespace NodeJS {
    interface Global {
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

export type API = {
  use: (plugin: Plugin<any>) => API
  startServer: () => void
}

export function createApp() {
  // During development we dynamically import all the schema modules
  //
  // TODO IDEA we have concept of schema module and schema dir
  //      add a "refactor" command to toggle between them
  // TODO put behind dev-mode guard
  // TODO static imports codegen at build time
  // TODO do not assume root source folder called `server`
  // TODO do not assume TS
  // TODO refactor and put a system behind this holy mother of...

  requireSchemaModules()

  const generatedPhotonPackagePath = fs.path('node_modules/@generated/photon')

  // Get the context module for the app.
  // User can provide a context module at a conventional path.
  // Otherwise we will provide a default context module.
  //
  // TODO context module should have flexible contract
  //      currently MUST return a createContext function
  const contextPath = findOrScaffold({
    fileNames: ['context.ts'],
    fallbackPath: fs.path('.pumpkins/context.ts'),
    fallbackContent: `\
  import { Photon } from '${trimNodeModulesIfInPath(
    generatedPhotonPackagePath
  )}'
  
  const photon = new Photon()
        
  export type Context = {
    photon: Photon
  }
        
  export const createContext = (): Context => ({
    photon,
  })`,
  })
  const context = require(contextPath)

  const plugins: Plugin<any>[] = []

  const api: API = {
    use(plugin) {
      plugins.push(plugin)
      return api
    },

    startServer(config: ServerOptions = {}): void {
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

        plugins.forEach(p => {
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
        })

        log('built up Nexus typegenConfig: %O', config)

        return config
      }

      const server = new ApolloServer({
        playground: mergedConfig.playground,
        introspection: mergedConfig.introspection,
        context: req => {
          const ctx = {}
          for (const plugin of plugins) {
            Object.assign(plugin.context.create(req))
          }
          Object.assign(ctx, context.createContext(req))
          return ctx
        },
        schema: makeSchema(nexusConfig),
      })

      const app = express()

      server.applyMiddleware({ app })

      app.listen({ port: mergedConfig.port }, () =>
        console.log(mergedConfig.startMessage(mergedConfig.port))
      )
    },
  }

  return api
}

export { objectType, inputObjectType, enumType, scalarType, unionType }
