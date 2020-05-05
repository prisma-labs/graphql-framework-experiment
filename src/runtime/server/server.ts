import createExpress, { Express } from 'express'
import * as ExpressGraphQL from 'express-graphql'
import { GraphQLSchema } from 'graphql'
import * as HTTP from 'http'
import * as Net from 'net'
import stripAnsi from 'strip-ansi'
import * as Plugin from '../../lib/plugin'
import { AppState } from '../app'
import * as DevMode from '../dev-mode'
import { ContextContributor } from '../schema/schema'
import { log } from './logger'
import { createRequestHandlerPlayground } from './request-handler-playground'
import { createServerSettingsManager } from './settings'

// Avoid forcing users to use esModuleInterop
const createExpressGraphql = ExpressGraphQL.default

export interface Server {
  express: Express
}

export function create(appState: AppState) {
  const resolverLogger = log.child('graphql')
  const settings = createServerSettingsManager()
  const express = createExpress()
  const state = {
    running: false,
    httpServer: HTTP.createServer(),
  }

  return {
    private: {
      settings,
      state,
      assemble(loadedRuntimePlugins: Plugin.RuntimeContributions[], schema: GraphQLSchema) {
        state.httpServer.on('request', express)

        if (settings.data.playground) {
          express.get(
            settings.data.playground.path,
            createRequestHandlerPlayground({ graphqlEndpoint: settings.data.path })
          )
        }

        const createContext = createContextCreator(
          appState.schemaComponent.contextContributors,
          loadedRuntimePlugins
        )

        express.use(
          settings.data.path,
          createExpressGraphql((req) => {
            return createContext(req).then((context) => ({
              ...settings,
              context: context,
              schema: schema,
              customFormatErrorFn: (error: Error) => {
                const colorlessMessage = stripAnsi(error.message)

                if (process.env.NEXUS_STAGE === 'dev') {
                  resolverLogger.error(error.stack ?? error.message)
                } else {
                  resolverLogger.error('An exception occured in one of your resolver', {
                    error: error.stack ? stripAnsi(error.stack) : colorlessMessage,
                  })
                }

                error.message = colorlessMessage

                return error
              },
            }))
          })
        )
      },
      async start() {
        await httpListen(state.httpServer, { port: settings.data.port, host: settings.data.host })

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
    public: {
      express,
    },
  }
}

type AnonymousRequest = Record<string, any>

type AnonymousContext = Record<string, any>

type ContextCreator<
  Req extends AnonymousRequest = AnonymousRequest,
  Context extends AnonymousContext = AnonymousContext
> = (req: Req) => Promise<Context>

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

function httpListen(server: HTTP.Server, options: Net.ListenOptions): Promise<void> {
  return new Promise((res, rej) => {
    server.listen(options, () => {
      res()
    })
  })
}

function httpClose(server: HTTP.Server): Promise<void> {
  return new Promise((res, rej) => {
    server.close((err) => {
      if (err) {
        rej(err)
      } else {
        res()
      }
    })
  })
}
