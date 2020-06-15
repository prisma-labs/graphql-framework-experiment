import createExpress, { Express } from 'express'
import { GraphQLSchema } from 'graphql'
import * as HTTP from 'http'
import { HttpError } from 'http-errors'
import * as Net from 'net'
import stripAnsi from 'strip-ansi'
import * as Plugin from '../../lib/plugin'
import { httpClose, httpListen, MaybePromise, noop } from '../../lib/utils'
import { AppState } from '../app'
import * as DevMode from '../dev-mode'
import { ContextContributor } from '../schema/schema'
import { assembledGuard } from '../utils'
import { createRequestHandlerGraphQL } from './handler-graphql'
import { createRequestHandlerPlayground } from './handler-playground'
import { log } from './logger'
import { createServerSettingsManager } from './settings'

const resolverLogger = log.child('graphql')

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
    engine: HTTP.Server
  }
  express: Express
  handlers: {
    playground: NexusRequestHandler
    graphql: NexusRequestHandler
  }
}

export const defaultState = {
  running: false,
  httpServer: HTTP.createServer(),
  createContext: null,
}

export function create(appState: AppState) {
  const settings = createServerSettingsManager()
  const express = createExpress()
  const state = { ...defaultState }

  const api: Server = {
    raw: {
      engine: state.httpServer,
    },
    express,
    handlers: {
      get playground() {
        return (
          assembledGuard(appState, 'app.server.handlers.playground', () => {
            // todo should be accessing settings from assembled app state settings
            return wrapHandlerWithErrorHandling(
              createRequestHandlerPlayground({ graphqlEndpoint: settings.data.path })
            )
          }) ?? noop
        )
      },
      get graphql() {
        return (
          assembledGuard(appState, 'app.server.handlers.graphql', () => {
            return wrapHandlerWithErrorHandling(
              createRequestHandlerGraphQL(appState.assembled!.schema, appState.assembled!.createContext)
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

        if (settings.data.playground) {
          express.get(
            settings.data.playground.path,
            wrapHandlerWithErrorHandling(
              createRequestHandlerPlayground({ graphqlEndpoint: settings.data.path })
            )
          )
        }

        const createContext = createContextCreator(
          appState.schemaComponent.contextContributors,
          loadedRuntimePlugins
        )

        const graphqlHandler = createRequestHandlerGraphQL(schema, createContext)

        express.post(settings.data.path, wrapHandlerWithErrorHandling(graphqlHandler))
        express.get(settings.data.path, wrapHandlerWithErrorHandling(graphqlHandler))

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
          playgroundPath: settings.data.playground ? settings.data.playground.path : undefined,
        })
        DevMode.sendServerReadySignalToDevModeMaster()
      },
      async stop() {
        if (!state.running) {
          log.warn('You called `server.stop` but the server was not running.')
          return Promise.resolve()
        }
        await httpClose(state.httpServer)
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
      const colorlessMessage = stripAnsi(error.message)

      if (process.env.NEXUS_STAGE === 'dev') {
        resolverLogger.error(error.stack ?? error.message)
      } else {
        resolverLogger.error('An exception occured in one of your resolver', {
          error: error.stack ? stripAnsi(error.stack) : colorlessMessage,
        })
      }

      // todo bring back payload sanitization for data sent to clients
      // error.message = colorlessMessage
    }
  }
}

type AnonymousRequest = Record<string, any>

type AnonymousContext = Record<string, any>

export type ContextCreator<
  Req extends AnonymousRequest = AnonymousRequest,
  Context extends AnonymousContext = AnonymousContext
> = (req: Req) => MaybePromise<Context>

/**
 * Combine all the context contributions defined in the app and in plugins.
 */
function createContextCreator(
  contextContributors: ContextContributor[],
  plugins: Plugin.RuntimeContributions[]
): ContextCreator {
  const createContext: ContextCreator = async (req) => {
    let context: Record<string, any> = {}

    // Integrate context from plugins
    for (const plugin of plugins) {
      if (!plugin.context) continue
      const contextContribution = await plugin.context.create(req)

      Object.assign(context, contextContribution)
    }

    // Integrate context from app context api
    // TODO good runtime feedback to user if something goes wrong
    for (const contextContributor of contextContributors) {
      const contextContribution = await contextContributor(req as any)

      Object.assign(context, contextContribution)
    }

    Object.assign(context, { log: log.child('request') })

    return context
  }

  return createContext
}
