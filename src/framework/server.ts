import createExpress from 'express'
import createExpressGraphql from 'express-graphql'
import * as HTTP from 'http'
import * as Net from 'net'
import * as Plugin from '../core/plugin'
import * as Logger from '../lib/logger'
import { sendServerReadySignalToDevModeMaster } from './dev-mode'

type Request = HTTP.IncomingMessage & { log: Logger.Logger }
type ContextContributor<T extends {}> = (req: Request) => T

/**
 * [API Reference](https://nexus-future.now.sh/#/references/api?id=server)  ⌁  [Guide](todo)
 *
 * ### todo
 *
 */
export type Server = {
  /**
   * todo
   */
  start: () => Promise<void>
  /**
   * todo
   */
  stop: () => Promise<void>
}

const log = Logger.create({ name: 'server' })

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
  startMessage: ({ port, host }): void => {
    log.info('listening', {
      url: `http://${host}:${port}`,
    })
  },
  playground: process.env.NODE_ENV === 'production' ? false : true,
}

export type ExtraSettingsInput = {
  /**
   * todo
   */
  port?: number
  /**
   * todo
   */
  playground?: boolean
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
export type SettingsInput = createExpressGraphql.OptionsData &
  ExtraSettingsInput & {
    plugins: Plugin.RuntimeContributions[]
    contextContributors: ContextContributor<any>[]
  }

export function create(settingsGiven: SettingsInput): Server {
  const http = HTTP.createServer()
  const express = createExpress()
  const opts = { ...defaultExtraSettings, ...settingsGiven }

  http.on('request', express)

  express.use(
    '/graphql',
    createExpressGraphql(req => {
      // TODO HACK
      ;(req as any).log = log.child('request')
      const context = {}

      // Integrate context from plugins
      for (const plugin of opts.plugins) {
        if (!plugin.context) continue
        const contextContribution = plugin.context.create(req)
        Object.assign(context, contextContribution)
      }

      // Integrate context from app context api
      // TODO support async; probably always supported by apollo server
      // TODO good runtime feedback to user if something goes wrong
      //
      for (const contextContributor of opts.contextContributors) {
        // HACK see req mutation at this func body start
        Object.assign(context, {
          ...contextContributor((req as unknown) as Request),
          log: ((req as unknown) as Request).log,
        })
      }
      return {
        ...opts,
        context,
      }
    })
  )

  if (opts.playground) {
    express.get('/', (req, res) => {
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
                endpoint: '/graphql'
              })
            })</script>
        </body>
  
        </html>
      `)
    })
  }

  return {
    start: () =>
      new Promise<void>(res => {
        http.listen({ port: opts.port, host: '127.0.0.1' }, () => {
          // - We do not support listening on unix domain sockets so string
          //   value will never be present here.
          // - We are working within the listen callback so address will not be null
          const address = http.address()! as Net.AddressInfo
          opts.startMessage({
            port: address.port,
            host: address.address === '127.0.0.1' ? 'localhost' : '',
            ip: address.address,
          })
          sendServerReadySignalToDevModeMaster()
          res()
        })
      }),
    stop: () =>
      new Promise<void>((res, rej) => {
        http.close(err => {
          if (err) {
            rej(err)
          } else {
            res()
          }
        })
      }),
  }
}
