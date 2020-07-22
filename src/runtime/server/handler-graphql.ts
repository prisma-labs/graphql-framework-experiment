import { GraphQLError, GraphQLFormattedError, GraphQLSchema } from 'graphql'
import { ApolloServerless } from './apollo-server-serverless'
import { log } from './logger'
import { ContextCreator, NexusRequestHandler } from './server'
import { PlaygroundSettings } from './settings'

type Settings = {
  introspection: boolean
  playground: false | PlaygroundSettings
  path: string
  errorFormatterFn(graphqlError: GraphQLError): GraphQLFormattedError
}

type CreateHandler = (
  schema: GraphQLSchema,
  createContext: ContextCreator,
  settings: Settings
) => NexusRequestHandler

/**
 * Create a handler for graphql requests.
 */
export const createRequestHandlerGraphQL: CreateHandler = (schema, createContext, settings) => {
  const server = new ApolloServerless({
    schema,
    context: createContext,
    formatError: settings.errorFormatterFn,
    logger: log,
    introspection: settings.introspection,
    playground: settings.playground,
  })

  return server.createHandler({ path: settings.path  })
}
