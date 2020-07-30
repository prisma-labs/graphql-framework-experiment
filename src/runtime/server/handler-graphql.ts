import { GraphQLError, GraphQLFormattedError, GraphQLSchema } from 'graphql'
import { ContextAdder } from '../schema'
import { ApolloServerless } from './apollo-server'
import { log } from './logger'
import { NexusRequestHandler } from './server'
import { PlaygroundLonghandInput } from './settings'

type Settings = {
  introspection: boolean
  playground: false | PlaygroundLonghandInput // todo why not use data? why input?
  path: string
  errorFormatterFn(graphqlError: GraphQLError): GraphQLFormattedError
}

type CreateHandler = (
  schema: GraphQLSchema,
  createContext: ContextAdder,
  settings: Settings
) => NexusRequestHandler

/**
 * Create a handler for graphql requests.
 */
export const createRequestHandlerGraphQL: CreateHandler = (schema, createContext, settings) => {
  const server = new ApolloServerless({
    schema,
    context: createContext,
    introspection: settings.introspection,
    formatError: settings.errorFormatterFn,
    logger: log,
    playground: settings.playground,
  })

  return server.createHandler({ path: settings.path })
}
