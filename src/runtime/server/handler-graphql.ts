import { ApolloServer as ApolloServerLambda } from 'apollo-server-lambda'
import { GraphQLError, GraphQLFormattedError, GraphQLSchema } from 'graphql'
import { log } from './logger'
import { ContextCreator, NexusRequestHandler } from './server'
import { ApolloServerless } from './apollo-server-serverless'

type Settings = {
  introspection: boolean
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
    formatError: settings.errorFormatterFn,
    logger: log,
    context: createContext,
    introspection: settings.introspection,
  })

  return server.createHandler()
}
