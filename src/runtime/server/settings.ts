import { PlaygroundRenderPageOptions } from 'apollo-server-express'
import { CorsOptions as OriginalCorsOption } from 'cors'
import * as Process from '../../lib/process'
import * as Utils from '../../lib/utils'
import { log as serverLogger } from './logger'

const log = serverLogger.child('settings')

export type PlaygroundSettings = {
  settings?: Omit<Partial<Exclude<PlaygroundRenderPageOptions['settings'], undefined>>, 'general.betaUpdates'>
}

export type CorsSettings = {
  /**
   * Configures the Access-Control-Allow-Origin CORS header. Possible values:
   *
   * Boolean - set origin to true to reflect the request origin, as defined by req.header('Origin'), or set it to false to disable CORS.
   * String - set origin to a specific origin. For example if you set it to "http://example.com" only requests from "http://example.com" will be allowed.
   * RegExp - set origin to a regular expression pattern which will be used to test the request origin. If it's a match, the request origin will be reflected. For example the pattern /example\.com$/ will reflect any request that is coming from an origin ending with "example.com".
   * Array - set origin to an array of valid origins. Each origin can be a String or a RegExp. For example ["http://example1.com", /\.example2\.com$/] will accept any request from "http://example1.com" or from a subdomain of "example2.com".
   * Function - set origin to a function implementing some custom logic. The function takes the request origin as the first parameter and a callback (called as callback(err, origin), where origin is a non-function value of the origin option) as the second.
   *
   */
  origin?: OriginalCorsOption['origin']
  /**
   * Configures the Access-Control-Allow-Methods CORS header.
   *
   * Expects a comma-delimited string (ex: 'GET,PUT,POST') or an array (ex: ['GET', 'PUT', 'POST']).
   */
  methods?: string | string[]
  /**
   * Configures the Access-Control-Allow-Headers CORS header.
   *
   * Expects a comma-delimited string (ex: 'Content-Type,Authorization') or an array (ex: ['Content-Type', 'Authorization']).
   * If not specified, defaults to reflecting the headers specified in the request's Access-Control-Request-Headers header.
   */
  allowedHeaders?: string | string[]
  /**
   * Configures the Access-Control-Expose-Headers CORS header.
   *
   * Expects a comma-delimited string (ex: 'Content-Range,X-Content-Range') or an array (ex: ['Content-Range', 'X-Content-Range']).
   * If not specified, no custom headers are exposed.
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

export type GraphqlSettings = {
  introspection?: boolean
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
   * Should GraphQL Playground be hosted by the server?
   *
   * @default `false` in production, `{ path: '/' }` otherwise
   *
   * @remarks
   *
   * Useful during development as a visual client to interact with your API. In
   * production, without some kind of security/access control, you will almost
   * certainly want this disabled.
   *
   * To learn more about GraphQL Playground see
   * https://github.com/prisma-labs/graphql-playground
   */
  playground?: boolean | PlaygroundSettings
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
  cors?: boolean | CorsSettings
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
  graphql?: GraphqlSettings
}

export type SettingsData = Omit<
  Utils.DeepRequired<SettingsInput>,
  'host' | 'playground' | 'graphql' | 'cors'
> & {
  host: string | undefined
  playground: false | Required<PlaygroundSettings>
  graphql: Required<GraphqlSettings>
  cors: boolean | CorsSettings
}

export const defaultPlaygroundPath = '/graphql'

export const defaultPlaygroundSettings: () => Readonly<Required<PlaygroundSettings>> = () => ({
  settings: {
    'general.betaUpdates': false,
    'editor.theme': 'dark',
    'editor.cursorShape': 'line',
    'editor.reuseHeaders': true,
    'tracing.hideTracingResponse': true,
    'queryPlan.hideQueryPlanResponse': true,
    'editor.fontSize': 14,
    'editor.fontFamily': `'Source Code Pro', 'Consolas', 'Inconsolata', 'Droid Sans Mono', 'Monaco', monospace`,
    'request.credentials': 'omit',
  },
})

export const defaultGraphqlSettings: () => Readonly<Required<GraphqlSettings>> = () => ({
  introspection: process.env.NODE_ENV === 'production' ? false : true,
})

/**
 * The default server options. These are merged with whatever you provide. Your
 * settings take precedence over these.
 */
export const defaultSettings: () => Readonly<SettingsData> = () => {
  return {
    host: process.env.NEXUS_HOST ?? process.env.HOST ?? undefined,
    port:
      typeof process.env.NEXUS_PORT === 'string'
        ? parseInt(process.env.NEXUS_PORT, 10)
        : typeof process.env.PORT === 'string'
        ? // e.g. Heroku convention https://stackoverflow.com/questions/28706180/setting-the-port-for-node-js-server-on-heroku
          parseInt(process.env.PORT, 10)
        : process.env.NODE_ENV === 'production'
        ? 80
        : 4000,
    startMessage: ({ port, host, path }): void => {
      serverLogger.info('listening', {
        url: `http://${Utils.prettifyHost(host)}:${port}${path}`,
      })
    },
    playground: process.env.NODE_ENV === 'production' ? false : defaultPlaygroundSettings(),
    path: '/graphql',
    cors: false,
    graphql: defaultGraphqlSettings(),
  }
}

export function playgroundSettings(
  playgroundSettings: SettingsInput['playground']
): SettingsData['playground'] {
  if (!playgroundSettings) {
    return false
  }

  const defaultSettings = defaultPlaygroundSettings()

  if (typeof playgroundSettings === 'boolean') {
    return {
      settings: defaultSettings.settings,
    }
  }

  return {
    settings: { ...defaultSettings.settings, ...playgroundSettings.settings },
  }
}

export function graphqlSettings(settings: SettingsInput['graphql']): SettingsData['graphql'] {
  return { ...defaultGraphqlSettings(), ...settings }
}

function validateGraphQLPath(path: string): string {
  let outputPath = path

  if (path.length === 0) {
    Process.fatal('Custom GraphQL `path` cannot be empty and must start with a /')
  }

  if (path.startsWith('/') === false) {
    log.warn('Custom GraphQL `path` must start with a "/". Please add it.')

    outputPath = '/' + outputPath
  }

  return outputPath
}

/**
 * Mutate the settings data
 */
export function changeSettings(state: SettingsData, newSettings: SettingsInput): void {
  const updatedSettings = { ...state, ...newSettings }

  state.playground = playgroundSettings(updatedSettings.playground)
  state.path = validateGraphQLPath(updatedSettings.path)
  state.port = updatedSettings.port
  state.startMessage = updatedSettings.startMessage
  state.graphql = graphqlSettings(updatedSettings.graphql)
  state.cors = updatedSettings.cors
}

export function createServerSettingsManager() {
  const data = defaultSettings()

  function change(newSettings: SettingsInput) {
    changeSettings(data, newSettings)
  }

  function reset() {
    for (const k of Object.keys(data)) {
      delete (data as any)[k]
    }
    Object.assign(data, defaultSettings())
  }

  return {
    change,
    reset,
    data,
  }
}

export type ServerSettingsManager = ReturnType<typeof createServerSettingsManager>
