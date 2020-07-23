import * as Process from '../../lib/process'
import * as Utils from '../../lib/utils'
import { PlaygroundRenderPageOptions } from 'apollo-server-express'
import { log as serverLogger } from './logger'

const log = serverLogger.child('settings')

export type PlaygroundSettings = {
  settings?: Omit<Partial<Exclude<PlaygroundRenderPageOptions['settings'], undefined>>, 'general.betaUpdates'>
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
   * To learn more about GraphQL Playgorund see
   * https://github.com/prisma-labs/graphql-playground
   */
  playground?: boolean | PlaygroundSettings
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
  startMessage?: (address: { port: number; host: string; ip: string; path: string }) => void
  /**
   * todo
   */
  graphql?: GraphqlSettings
}

export type SettingsData = Omit<Utils.DeepRequired<SettingsInput>, 'host' | 'playground' | 'graphql'> & {
  host: string | undefined
  playground: false | Required<PlaygroundSettings>
  graphql: Required<GraphqlSettings>
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
