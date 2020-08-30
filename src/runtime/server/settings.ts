import { PlaygroundRenderPageOptions } from 'apollo-server-express'
import { CorsOptions as OriginalCorsOption } from 'cors'
import * as Setset from 'setset'
import { LiteralUnion, Primitive } from 'type-fest'
import * as Utils from '../../lib/utils'
import { log as serverLogger } from './logger'

type ResolvedOptional<T> = Exclude<NonNullable<T>, Primitive>

export type ServerSettingsManager = Setset.Manager<SettingsInput, SettingsData>

export type HTTPMethods = LiteralUnion<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD', string>

export type PlaygroundLonghandInput = {
  /**
   * Should the [GraphQL Playground](https://github.com/prisma-labs/graphql-playground) be hosted by the server?
   *
   * @dynamicDefault
   *
   * - If not production then `true`
   * - Otherwise `false`
   *
   * @remarks
   *
   * GraphQL Playground is useful during development as a visual client to interact with your API. In
   * production, without some kind of security/access control, you will almost
   * certainly want it disabled.
   */
  enabled?: boolean

  // todo consider de-nesting the settings field

  /**
   * Configure the settings of the GraphQL Playground app itself.
   */
  settings?: Omit<Partial<Exclude<PlaygroundRenderPageOptions['settings'], undefined>>, 'general.betaUpdates'>
}

export type SettingsInput = {
  /**
   * todo
   */
  port?: number
  /**
   * Host the server should be listening on.
   */
  host?: string | undefined
  /**
   * Configure the [GraphQL Playground](https://github.com/prisma-labs/graphql-playground) hosted by the server.
   *
   * - Pass `true` as shorthand for  `{ enabled: true }`
   * - Pass `false` as shorthand for `{ enabled: false }`
   * - Pass an object to configure
   *
   * @dynamicDefault
   *
   * - If not production then `true`
   * - Otherwise `false`
   *
   * @remarks
   *
   * GraphQL Playground is useful during development as a visual client to interact with your API. In
   * production, without some kind of security/access control, you will almost
   * certainly want it disabled.
   */
  playground?: boolean | PlaygroundLonghandInput
  /**
   * Enable CORS for your server
   *
   * When true is passed, the default config is the following:
   *
   * ```
   * {
   *   "origin": "*",
   *   "methods": "GET,HEAD,PUT,PATCH,POST,DELETE",
   *   "preflightContinue": false,
   *   "optionsSuccessStatus": 204
   * }
   * ```
   *
   * @default false
   */
  cors?:
    | boolean
    | {
        /**
         * Enable or disable CORS.
         *
         * @default true
         */
        enabled?: boolean
        /**
         * Configures the Access-Control-Allow-Origin CORS header. Possible values:
         *
         * Boolean - set origin to true to reflect the request origin, as defined by req.header('Origin'), or set it to false to disable CORS.
         *
         * String - set origin to a specific origin. For example if you set it to "http://example.com" only requests from "http://example.com" will be allowed.
         *
         * RegExp - set origin to a regular expression pattern which will be used to test the request origin. If it's a match, the request origin will be reflected. For example the pattern /example\.com$/ will reflect any request that is coming from an origin ending with "example.com".
         *
         * Array - set origin to an array of valid origins. Each origin can be a String or a RegExp. For example ["http://example1.com", /\.example2\.com$/] will accept any request from "http://example1.com" or from a subdomain of "example2.com".
         *
         * Function - set origin to a function implementing some custom logic. The function takes the request origin as the first parameter and a callback (called as callback(err, origin), where origin is a non-function value of the origin option) as the second.
         *
         */
        origin?: OriginalCorsOption['origin'] // TODO: Improve function interface with promise-based callback
        /**
         * Configures the Access-Control-Allow-Methods CORS header.
         *
         * @example ['GET', 'PUT', 'POST']
         */
        methods?: string | HTTPMethods[]
        /**
         * Configures the Access-Control-Allow-Headers CORS header.
         *
         * If not specified, defaults to reflecting the headers specified in the request's Access-Control-Request-Headers header.
         *
         * @example ['Content-Type', 'Authorization']
         */
        allowedHeaders?: string | string[]
        /**
         * Configures the Access-Control-Expose-Headers CORS header.
         *
         * If not specified, no custom headers are exposed.
         *
         * @example ['Content-Range', 'X-Content-Range']
         */
        exposedHeaders?: string | string[]
        /**
         * Configures the Access-Control-Allow-Credentials CORS header.
         *
         * Set to true to pass the header, otherwise it is omitted.
         */
        credentials?: boolean
        /**
         * Configures the Access-Control-Max-Age CORS header.
         *
         * Set to an integer to pass the header, otherwise it is omitted.
         */
        maxAge?: number
        /**
         * Pass the CORS preflight response to the next handler.
         */
        preflightContinue?: boolean
        /**
         * Provides a status code to use for successful OPTIONS requests, since some legacy browsers (IE11, various SmartTVs) choke on 204.
         */
        optionsSuccessStatus?: number
      }
  /**
   * The path on which the GraphQL API should be served.
   *
   * @default /graphql
   */
  path?: string
  /**
   * Create a message suitable for printing to the terminal about the server
   * having been booted.
   */
  startMessage?: (address: { port: number; host: string; ip: string; path: string }) => void
  /**
   * todo
   */
  graphql?: {
    introspection?: boolean
  }
}

export type SettingsData = Setset.InferDataFromInput<Omit<SettingsInput, 'host' | 'cors'>> & {
  host?: string
  cors: ResolvedOptional<SettingsInput['cors']>
}

type a = SettingsData['host']

export const createServerSettingsManager = () =>
  Setset.create<SettingsInput, SettingsData>({
    fields: {
      playground: {
        shorthand(enabled) {
          return { enabled }
        },
        fields: {
          enabled: {
            initial() {
              return process.env.NODE_ENV === 'production' ? false : true
            },
          },
          settings: {
            fields: {
              'editor.cursorShape': {
                initial() {
                  return 'block'
                },
              },
              'editor.fontFamily': {
                initial() {
                  return `'Source Code Pro', 'Consolas', 'Inconsolata', 'Droid Sans Mono', 'Monaco', monospace`
                },
              },
              'editor.fontSize': {
                initial() {
                  return 14
                },
              },
              'editor.reuseHeaders': {
                initial() {
                  return true
                },
              },
              'editor.theme': {
                initial() {
                  return 'dark'
                },
              },
              'queryPlan.hideQueryPlanResponse': {
                initial() {
                  return true
                },
              },
              'request.credentials': {
                initial() {
                  return 'omit'
                },
              },
              'tracing.hideTracingResponse': {
                initial() {
                  return true
                },
              },
            },
          },
        },
      },
      cors: {
        shorthand(enabled) {
          return { enabled, exposedHeaders: [] }
        },
        fields: {
          allowedHeaders: {},
          credentials: {},
          enabled: {},
          exposedHeaders: {},
          maxAge: {},
          methods: {},
          optionsSuccessStatus: {},
          origin: {},
          preflightContinue: {},
        },
      },
      graphql: {
        fields: {
          introspection: {
            initial() {
              return process.env.NODE_ENV === 'production' ? false : true
            },
          },
        },
      },
      host: {
        initial() {
          return process.env.NEXUS_HOST ?? process.env.HOST ?? undefined
        },
      },
      path: {
        initial() {
          return '/graphql'
        },
        validate(value) {
          if (value.length === 0) {
            return { reasons: ['Custom GraphQL `path` cannot be empty and must start with a /'] }
          }

          return null
        },
        fixup(value) {
          const messages: string[] = []

          if (!value.startsWith('/')) {
            messages.push('Custom GraphQL `path` must start with a "/". Please add it.')
            value = '/' + value
          }

          return messages.length ? { value, messages } : null
        },
      },
      port: {
        initial() {
          return typeof process.env.NEXUS_PORT === 'string'
            ? parseInt(process.env.NEXUS_PORT, 10)
            : typeof process.env.PORT === 'string'
            ? // e.g. Heroku convention https://stackoverflow.com/questions/28706180/setting-the-port-for-node-js-server-on-heroku
              parseInt(process.env.PORT, 10)
            : process.env.NODE_ENV === 'production'
            ? 80
            : 4000
        },
      },
      startMessage: {
        initial() {
          return ({ port, host, path }): void => {
            serverLogger.info('listening', {
              url: `http://${Utils.prettifyHost(host)}:${port}${path}`,
            })
          }
        },
      },
    },
  })
