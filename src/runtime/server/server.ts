import * as Logger from '@nexus/logger'
import createExpress, { Express } from 'express'
import * as ExpressGraphQL from 'express-graphql'
import * as GraphQL from 'graphql'
import * as HTTP from 'http'
import * as Net from 'net'
import stripAnsi from 'strip-ansi'
import * as Plugin from '../../lib/plugin'
import * as Utils from '../../lib/utils'
import * as DevMode from '../dev-mode'
import { log } from './logger'
import * as ServerSettings from './settings'

// Avoid forcing users to use esModuleInterop
const createExpressGraphql = ExpressGraphQL.default
const resolverLogger = log.child('graphql')

type Request = HTTP.IncomingMessage & { log: Logger.Logger }
type ContextContributor<T extends {}> = (req: Request) => Utils.MaybePromise<T>

export type ExpressInstance = Omit<Express, 'listen'>

export interface BaseServer {
  /**
   * Start the server instance
   */
  start(): Promise<void>
  /**
   * Stop the server instance
   */
  stop(): Promise<void>
}

/**
 * [API Reference](https://www.nexusjs.org/#/api/modules/main/exports/server)  ⌁  [Guide](todo)
 *
 * ### todo
 *
 */
export interface Server extends BaseServer {
  /**
   * Gives access to the underlying express instance
   * Do not use `express.listen` but `server.start` instead
   */
  express: ExpressInstance
}

export type SetupExpressInput = ExpressGraphQL.OptionsData &
  ServerSettings.SettingsData & {
    context: ContextCreator
  }

function setupExpress(express: Express, settings: SetupExpressInput): BaseServer {
  const http = HTTP.createServer()

  http.on('request', express)

  express.use(
    settings.path,
    createExpressGraphql((req) => {
      return settings.context(req).then((resolvedCtx) => ({
        ...settings,
        context: resolvedCtx,
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
  if (settings.playground) {
    express.get(settings.playground.path, (_req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>

        <head>
          <meta charset=utf-8/>
          <meta name="viewport" content="user-scalable=no, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, minimal-ui">
          <title>GraphQL Playground</title>
          <link rel="stylesheet" href="//cdn.jsdelivr.net/npm/graphql-playground-react/build/static/css/index.css" />
          <link rel="shortcut icon" href="//cdn.jsdelivr.net/npm/graphql-playground-react/build/favicon.png" />
          <script src="//cdn.jsdelivr.net/npm/graphql-playground-react/build/static/js/middleware.js"></script>
        </head>

        <body>
          <div id="root">
            <style>
              body {
                background-color: rgb(23, 42, 58);
                font-family: Open Sans, sans-serif;
                height: 90vh;
              }

              #root {
                height: 100%;
                width: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
              }

              .loading {
                font-size: 32px;
                font-weight: 200;
                color: rgba(255, 255, 255, .6);
                margin-left: 20px;
              }

              img {
                width: 78px;
                height: 78px;
              }

              .title {
                font-weight: 400;
              }
            </style>
            <img src='//cdn.jsdelivr.net/npm/graphql-playground-react/build/logo.png' alt=''>
            <div class="loading"> Loading
              <span class="title">GraphQL Playground</span>
            </div>
          </div>
          <script>window.addEventListener('load', function (event) {
              GraphQLPlayground.init(document.getElementById('root'), {
                endpoint: '${settings.path}'
              })
            })</script>
        </body>

        </html>
      `)
    })
  }

  return {
    start: () =>
      new Promise<void>((res) => {
        http.listen({ port: settings.port, host: settings.host }, () => {
          // - We do not support listening on unix domain sockets so string
          //   value will never be present here.
          // - We are working within the listen callback so address will not be null
          const address = http.address()! as Net.AddressInfo
          settings.startMessage({
            port: address.port,
            host: address.address,
            ip: address.address,
            path: settings.path,
            playgroundPath: settings.playground ? settings.playground.path : undefined,
          })
          res()
        })
      }),
    stop: () =>
      new Promise<void>((res, rej) => {
        http.close((err) => {
          if (err) {
            rej(err)
          } else {
            res()
          }
        })
      }),
  }
}

interface ServerFactory {
  setupAndStart(opts: {
    schema: GraphQL.GraphQLSchema
    plugins: Plugin.RuntimeContributions[]
    contextContributors: ContextContributor<any>[]
  }): Promise<void>
  stop(): Promise<void>
  express: ExpressInstance
  settings: {
    change(settings: ServerSettings.SettingsInput): void
    data: ServerSettings.SettingsData
  }
}

export function create(): ServerFactory {
  const express = createExpress()
  let server: BaseServer | null = null
  const state = {
    settings: ServerSettings.defaultSettings(),
  }

  return {
    express,
    async setupAndStart(opts: {
      schema: GraphQL.GraphQLSchema
      plugins: Plugin.RuntimeContributions[]
      contextContributors: ContextContributor<any>[]
    }) {
      const context = contextFactory(opts.contextContributors, opts.plugins)

      server = setupExpress(express, {
        ...state.settings,
        schema: opts.schema,
        context,
      })

      await server.start()

      DevMode.sendServerReadySignalToDevModeMaster()
    },
    stop() {
      if (!server) {
        log.warn('You called `server.stop` before calling `server.start`')
        return Promise.resolve()
      }

      return server.stop()
    },
    settings: {
      change(newSettings) {
        state.settings = ServerSettings.changeSettings(state.settings, newSettings)
      },
      data: state.settings,
    },
  }
}

type AnonymousRequest = Record<string, any>
type AnonymousContext = Record<string, any>

type ContextCreator<
  Req extends AnonymousRequest = AnonymousRequest,
  Context extends AnonymousContext = AnonymousContext
> = (req: Req) => Promise<Context>

function contextFactory(
  contextContributors: ContextContributor<any>[],
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
      const contextContribution = await contextContributor((req as unknown) as Request)

      Object.assign(context, contextContribution)
    }

    Object.assign(context, { log: log.child('request') })

    return context
  }

  return createContext
}
