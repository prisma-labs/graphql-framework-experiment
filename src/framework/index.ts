import { ApolloServer, ApolloServerExpressConfig } from 'apollo-server-express'
import * as express from 'express'
import { makeSchema } from './nexus'

export {
  objectType,
  inputObjectType,
  enumType,
  scalarType,
  unionType,
} from './nexus'

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
  return {
    startServer(config: ServerOptions = {}) {
      const mergedConfig: Required<ServerOptions> = {
        ...defaultServerOptions,
        ...config,
      }
      const server = new ApolloServer({
        schema: makeSchema(),
        playground: mergedConfig.playground,
        introspection: mergedConfig.introspection,
      })
      const app = express()

      server.applyMiddleware({ app })

      app.listen({ port: mergedConfig.port }, () =>
        console.log(mergedConfig.startMessage(mergedConfig.port))
      )
    },
  }
}
