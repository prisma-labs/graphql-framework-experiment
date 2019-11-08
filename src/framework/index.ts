import { ApolloServer } from 'apollo-server-express'
import express from 'express'
import { createNexusSingleton, QueryType, MutationType } from './nexus'
import { intArg, stringArg } from 'nexus'
import * as fs from 'fs-jetpack'
import Debug from 'debug'
import { nexusPrismaPlugin } from 'nexus-prisma'

const debug = Debug('pumpkins:app')

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

export function createApp() {
  //
  // During development we dynamically import all the schema modules
  // TODO put behind dev-mode guard
  // TODO static imports codegen at build time
  // TODO do not assume root source folder called `server`
  // TODO do not assume TS
  //
  debug('finding schema modules ...')
  fs.find(fs.path('server/schema'), {
    files: true,
    directories: false,
    recursive: true,
    matching: '*.ts',
  }).forEach(schemaModulePath => {
    debug('importing %s', schemaModulePath)
    require(fs.path(schemaModulePath))
  })

  // TODO the presence of context module should be optional
  // TODO context module should have flexible contract
  //      currently MUST return a createContext function
  const contextModulePath = fs.path('server/context.ts')
  const context = require(contextModulePath)

  return {
    startServer(config: ServerOptions = {}) {
      const mergedConfig: Required<ServerOptions> = {
        ...defaultServerOptions,
        ...config,
      }

      const shouldGenerateArtifacts =
        process.env.PUMPKINS_SHOULD_GENERATE_ARTIFACTS === 'true'
          ? true
          : process.env.PUMPKINS_SHOULD_GENERATE_ARTIFACTS === 'false'
          ? false
          : Boolean(
              !process.env.NODE_ENV || process.env.NODE_ENV === 'development'
            )
      const shouldExitAfterGenerateArtifacts =
        process.env.PUMPKINS_SHOULD_EXIT_AFTER_GENERATE_ARTIFACTS === 'true'
          ? true
          : false

      const server = new ApolloServer({
        schema: makeSchema({
          typegenAutoConfig: {
            contextType: 'Context.Context',
            // TODO add photon to backing types
            sources: [{ source: contextModulePath, alias: 'Context' }],
          },
          shouldGenerateArtifacts,
          shouldExitAfterGenerateArtifacts,
          plugins: [
            nexusPrismaPlugin({
              inputs: {
                photon: fs.path('node_modules/@generated/photon'),
              },
              outputs: {
                typegen: fs.path(
                  'node_modules/@types/nexus-typegen-prisma/index.d.ts'
                ),
              },
              shouldGenerateArtifacts,
            }),
          ],
        }),
        playground: mergedConfig.playground,
        introspection: mergedConfig.introspection,
        context: context.createContext,
      })

      const app = express()

      server.applyMiddleware({ app })

      app.listen({ port: mergedConfig.port }, () =>
        console.log(mergedConfig.startMessage(mergedConfig.port))
      )
    },
  }
}

export { objectType, inputObjectType, enumType, scalarType, unionType }
