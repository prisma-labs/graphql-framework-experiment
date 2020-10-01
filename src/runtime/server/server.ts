import chalk from 'chalk'
import createExpress, { Express } from 'express'
import { GraphQLSchema } from 'graphql'
import * as HTTP from 'http'
import { isEmpty } from 'lodash'
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
import { fatal } from '../../lib/process'

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
  enableSubscriptionsServer: boolean
}

export const defaultState = {
  running: false,
  httpServer: HTTP.createServer(),
  createContext: null,
  apolloServer: null,
  enableSubscriptionsServer: false,
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
        state.httpServer.on('error', async function (err: NodeJS.ErrnoException)  {
          if (err.code === 'EADDRINUSE') {
            fatal(`Port ${settings.data.port} is already in use.`, { ...err })
          }
        });

        const createContext = createContextCreator(
          appState.components.schema.contextContributors,
          loadedRuntimePlugins
        )

        /**
         * Resolve if subscriptions are enabled or not
         */

        if (settings.metadata.fields.subscriptions.fields.enabled.from === 'change') {
          state.enableSubscriptionsServer = settings.data.subscriptions.enabled
          /**
           * Validate the integration of server subscription settings and the schema subscription type definitions.
           */
          if (hasSubscriptionFields(schema)) {
            if (!settings.data.subscriptions.enabled) {
              log.error(
                `You have disabled server subscriptions but your schema has a ${chalk.yellowBright(
                  'Subscription'
                )} type with fields present. When your API clients send subscription operations at runtime they will fail.`
              )
            }
          } else if (settings.data.subscriptions.enabled) {
            log.warn(
              `You have enabled server subscriptions but your schema has no ${chalk.yellowBright(
                'Subscription'
              )} type with fields.`
            )
          }
        } else if (hasSubscriptionFields(schema)) {
          state.enableSubscriptionsServer = true
        }

        /**
         * Setup Apollo Server
         */

        state.apolloServer = new ApolloServerExpress({
          schema,
          engine: settings.data.apollo.engine.enabled ? settings.data.apollo.engine : false,
          // todo expose options
          subscriptions: settings.data.subscriptions,
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

        if (state.enableSubscriptionsServer) {
          state.apolloServer.installSubscriptionHandlers(state.httpServer)
        }

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
          paths: {
            graphql: settings.data.path,
            graphqlSubscriptions: state.enableSubscriptionsServer ? settings.data.subscriptions.path : null,
          },
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

function hasSubscriptionFields(schema: GraphQLSchema): boolean {
  return !isEmpty(schema.getSubscriptionType()?.getFields())
}
