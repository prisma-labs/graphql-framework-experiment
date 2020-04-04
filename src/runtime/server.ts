import createExpress, { Express } from 'express'
import * as ExpressGraphQL from 'express-graphql'
import * as GraphQL from 'graphql'
import * as HTTP from 'http'
import * as Net from 'net'
import stripAnsi from 'strip-ansi'
import * as Logger from '../lib/logger'
import * as Plugin from '../lib/plugin'
import * as App from './app'
import * as DevMode from './dev-mode'

// Avoid forcing users to use esModuleInterop
const createExpressGraphql = ExpressGraphQL.default

type Request = HTTP.IncomingMessage & { log: Logger.Logger }
type ContextContributor<T extends {}> = (req: Request) => T

const log = Logger.create({ name: 'server' })
const resolverLogger = log.child('graphql')

/**
 * The default server options. These are merged with whatever you provide. Your
 * settings take precedence over these.
 */
export const defaultExtraSettings: Required<ExtraSettingsInput> = {
  port:
    typeof process.env.NEXUS_PORT === 'string'
      ? parseInt(process.env.NEXUS_PORT, 10)
      : typeof process.env.PORT === 'string'
      ? // e.g. Heroku convention https://stackoverflow.com/questions/28706180/setting-the-port-for-node-js-server-on-heroku
        parseInt(process.env.PORT, 10)
      : process.env.NODE_ENV === 'production'
      ? 80
      : 4000,
  host: process.env.NEXUS_HOST || process.env.HOST || 'localhost',
  startMessage: ({ port, host }): void => {
    const prettyHost = host === '127.0.0.1' ? 'localhost' : host
    log.info('listening', {
      url: `http://${prettyHost}:${port}`,
    })
  },
  playground: process.env.NODE_ENV === 'production' ? false : true,
  path: '/graphql',
}

export type ExtraSettingsInput = {
  /**
   * todo
   */
  port?: number
  /**
   * Host the server should be listening on.
   */
  host?: string
  /**
   * todo
   */
  playground?: boolean
  /**
   * The path on which the GraphQL API should be served.
   *
   * @default
   * /graphql
   */
  path?: string
  /**
   * Create a message suitable for printing to the terminal about the server
   * having been booted.
   */
  startMessage?: (address: { port: number; host: string; ip: string }) => void
}

export type ExtraSettingsData = Required<ExtraSettingsInput>

/**
 * The available server options to configure how your app runs its server.
 */
export type SettingsInput = ExpressGraphQL.OptionsData &
  ExtraSettingsInput & {
    context: ContextCreator
  }

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

function setupExpress(
  express: Express,
  settingsGiven: SettingsInput
): BaseServer {
  const http = HTTP.createServer()
  const opts = { ...defaultExtraSettings, ...settingsGiven }

  http.on('request', express)

  express.use(
    opts.path,
    createExpressGraphql((req) => {
      return {
        ...opts,
        context: settingsGiven.context(req),
        customFormatErrorFn: (error) => {
          const colorlessMessage = stripAnsi(error.message)

          if (process.env.NEXUS_STAGE === 'dev') {
            resolverLogger.error(error.stack ?? error.message)
          } else {
            resolverLogger.error(
              'An exception occured in one of your resolver',
              {
                error: error.stack ? stripAnsi(error.stack) : colorlessMessage,
              }
            )
          }

          error.message = colorlessMessage

          return error
        },
      }
    })
  )

  if (opts.playground) {
    express.get('/', (_req, res) => {
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
                endpoint: '${opts.path}'
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
        http.listen({ port: opts.port, host: opts.host }, () => {
          // - We do not support listening on unix domain sockets so string
          //   value will never be present here.
          // - We are working within the listen callback so address will not be null
          const address = http.address()! as Net.AddressInfo
          opts.startMessage({
            port: address.port,
            host: address.address,
            ip: address.address,
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
    settings: App.Settings
  }): Promise<void>
  stop(): Promise<void>
  express: ExpressInstance
}

export function create(): ServerFactory {
  const express = createExpress()
  let server: BaseServer | null = null

  return {
    express,
    async setupAndStart(opts: {
      schema: GraphQL.GraphQLSchema
      plugins: Plugin.RuntimeContributions[]
      contextContributors: ContextContributor<any>[]
      settings: App.Settings
    }) {
      const context = contextFactory(opts.contextContributors, opts.plugins)

      server = setupExpress(express, {
        ...opts,
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
  }
}

type AnonymousRequest = Record<string, any>
type AnonymousContext = Record<string, any>

interface ContextCreator<
  Req extends AnonymousRequest = AnonymousRequest,
  Context extends AnonymousContext = AnonymousContext
> {
  (req: Req): Context
}

function contextFactory(
  contextContributors: ContextContributor<any>[],
  plugins: Plugin.RuntimeContributions[]
): ContextCreator {
  const createContext: ContextCreator = (req) => {
    let context: Record<string, any> = {}

    // TODO HACK
    ;(req as any).log = log.child('request')

    // Integrate context from plugins
    for (const plugin of plugins) {
      if (!plugin.context) continue
      const contextContribution = plugin.context.create(req)
      Object.assign(context, contextContribution)
    }

    // Integrate context from app context api
    // TODO support async; probably always supported by apollo server
    // TODO good runtime feedback to user if something goes wrong
    for (const contextContributor of contextContributors) {
      // HACK see req mutation at this func body start
      Object.assign(context, {
        ...contextContributor((req as unknown) as Request),
        log: ((req as unknown) as Request).log,
      })
    }

    // TODO: TS error if not casted to any :(
    return context
  }

  return createContext
}
