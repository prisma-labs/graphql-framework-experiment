import createExpress, { Express } from 'express'
import { GraphQLError, GraphQLSchema } from 'graphql'
import * as HTTP from 'http'
import { HttpError } from 'http-errors'
import * as Net from 'net'
import * as Plugin from '../../lib/plugin'
import { httpClose, httpListen, noop } from '../../lib/utils'
import { AppState } from '../app'
import * as DevMode from '../dev-mode'
import { ContextAdder } from '../schema'
import { assembledGuard } from '../utils'
import { ApolloServerExpress } from './apollo-server'
import { errorFormatter } from './error-formatter'
import { createRequestHandlerGraphQL } from './handler-graphql'
import { log } from './logger'
import { createServerSettingsManager } from './settings'

const resolverLogger = log.child('apollo')

export type NexusRequestHandler = (req: HTTP.IncomingMessage, res: HTTP.ServerResponse) => void

/**
 * Public interface of the server component
 */
export interface Server {
  /**
   * Escape hatches to various Nexus server internals.
   *
   * These things are available mostly as escape hatches, and maybe a few valid advanced use-cases. If you haven't already/are not sure, consider [opening an issue](https://nxs.li/issues/create/feature) for your use-case. Maybe Nexus can and should provide better first-class support for what you are trying to do!
   */
  raw: {
    /**
     * The underlying [Node HTTP Server](https://nodejs.org/api/http.html#http_class_http_server) instance.
     *
     * Access to this is made available mostly as an escape hatch, and maybe a few valid advanced use-cases. If you haven't already/are not sure, consider [opening an issue](https://nxs.li/issues/create/feature) for your use-case. Maybe Nexus can and should provide better first-class support for what you are trying to do!
     */
    http: HTTP.Server
  }
  express: Express
  handlers: {
    graphql: NexusRequestHandler
  }
}

interface State {
  running: boolean
  httpServer: HTTP.Server
  createContext: null | (() => ContextAdder)
  apolloServer: null | ApolloServerExpress
}

export const defaultState = {
  running: false,
  httpServer: HTTP.createServer(),
  createContext: null,
  apolloServer: null,
}

export function create(appState: AppState) {
  const settings = createServerSettingsManager()
  const express = createExpress()

  const state: State = { ...defaultState }

  const api: Server = {
    raw: {
      http: state.httpServer,
    },
    express,
    handlers: {
      get graphql() {
        return (
          assembledGuard(appState, 'app.server.handlers.graphql', () => {
            if (settings.data.cors.enabled) {
              log.warn('CORS does not work for serverless handlers. Settings will be ignored.')
            }

            return createRequestHandlerGraphQL(
              appState.assembled!.schema,
              appState.assembled!.createContext,
              {
                path: settings.data.path,
                introspection: settings.data.graphql.introspection,
                playground: settings.data.playground.enabled ? settings.data.playground : false,
                errorFormatterFn: errorFormatter,
              }
            )
          }) ?? noop
        )
      },
    },
  }

  const internalServer = {
    private: {
      settings,
      state,
      reset() {
        internalServer.private.state = { ...defaultState }
      },
      assemble(loadedRuntimePlugins: Plugin.RuntimeContributions[], schema: GraphQLSchema) {
        state.httpServer.on('request', express)

        const createContext = createContextCreator(
          appState.components.schema.contextContributors,
          loadedRuntimePlugins
        )

        state.apolloServer = new ApolloServerExpress({
          schema,
          engine: settings.data.apollo.engine.enabled ? settings.data.apollo.engine : false,
          context: createContext,
          introspection: settings.data.graphql.introspection,
          formatError: errorFormatter,
          logger: resolverLogger,
          playground: settings.data.playground.enabled
            ? {
                endpoint: settings.data.path,
                settings: settings.data.playground.settings,
              }
            : false,
        })

        state.apolloServer.applyMiddleware({
          app: express,
          path: settings.data.path,
          cors: settings.data.cors,
        })

        return { createContext }
      },
      async start() {
        await httpListen(state.httpServer, { port: settings.data.port, host: settings.data.host })
        state.running = true

        // About !
        // 1. We do not support listening on unix domain sockets so string
        //    value will never be present here.
        // 2. We are working within the listen callback so address will not be null
        const address = state.httpServer.address()! as Net.AddressInfo

        settings.data.startMessage({
          port: address.port,
          host: address.address,
          ip: address.address,
          path: settings.data.path,
        })
        DevMode.sendServerReadySignalToDevModeMaster()
      },
      async stop() {
        if (!state.running) {
          log.warn('You called `server.stop` but the server was not running.')
          return Promise.resolve()
        }
        await httpClose(state.httpServer)
        await state.apolloServer?.stop()
        state.running = false
      },
    },
    public: api,
  }

  return internalServer
}

/**
 * Log http errors during development.
 */
const wrapHandlerWithErrorHandling = (handler: NexusRequestHandler): NexusRequestHandler => {
  return async (req, res) => {
    await handler(req, res)
    if (res.statusCode !== 200 && (res as any).error) {
      const error: HttpError = (res as any).error
      const graphqlErrors: GraphQLError[] = error.graphqlErrors

      if (graphqlErrors.length > 0) {
        graphqlErrors.forEach(errorFormatter)
      } else {
        log.error(error.message, {
          error,
        })
      }
    }
  }
}

/**
 * Combine all the context contributions defined in the app and in plugins.
 */
function createContextCreator(
  contextContributors: ContextAdder[],
  plugins: Plugin.RuntimeContributions[]
): ContextAdder {
  const createContext: ContextAdder = async (params) => {
    let context: Record<string, any> = {}

    // Integrate context from plugins
    for (const plugin of plugins) {
      if (!plugin.context) continue
      const contextContribution = await plugin.context.create(params.req)

      Object.assign(context, contextContribution)
    }

    // Integrate context from app context api
    // TODO good runtime feedback to user if something goes wrong
    for (const contextContributor of contextContributors) {
      const contextContribution = await contextContributor(params)

      Object.assign(context, contextContribution)
    }

    Object.assign(context, { log: log.child('request') })

    return context
  }

  return createContext
}
