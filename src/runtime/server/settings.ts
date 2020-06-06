import * as Process from '../../lib/process'
import * as Utils from '../../lib/utils'
import { log as serverLogger } from './logger'

const log = serverLogger.child('settings')

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
  startMessage?: (address: {
    port: number
    host: string
    ip: string
    path: string
    playgroundPath?: string
  }) => void
}

export type SettingsData = Omit<Utils.DeepRequired<SettingsInput>, 'host' | 'playground'> & {
  host: string | undefined
  playground: false | Required<PlaygroundSettings>
}

export const defaultPlaygroundPath = '/'

/*
 * Typings and defaults for `graphql-playground-react`
 * https://github.com/prisma-labs/graphql-playground/blob/master/packages/graphql-playground-react/src/types.ts
 */
export type PlaygroundCursorShape = 'line' | 'block' | 'underline'
export type PlaygroundTheme = 'dark' | 'light'

export type PlaygroundClientSettings = {
  'editor.cursorShape'?: PlaygroundCursorShape
  'editor.fontFamily'?: string
  'editor.fontSize'?: number
  'editor.reuseHeaders'?: boolean
  'editor.theme'?: PlaygroundTheme
  'general.betaUpdates'?: boolean
  'prettier.printWidth'?: number
  'prettier.tabWidth'?: number
  'prettier.useTabs'?: boolean
  'request.credentials'?: 'omit' | 'include' | 'same-origin'
  'schema.disableComments'?: boolean
  'schema.polling.enable'?: boolean
  'schema.polling.endpointFilter'?: string
  'schema.polling.interval'?: number
  'tracing.hideTracingResponse'?: boolean
  'tracing.tracingSupported'?: boolean
}

export type PlaygroundSettings = {
  path?: string
  clientSettings?: PlaygroundClientSettings
}

export const defaultPlaygroundSettings: () => Readonly<Required<PlaygroundSettings>> = () => ({
  path: defaultPlaygroundPath,
  clientSettings: {
    'editor.cursorShape': 'line',
    'editor.fontFamily': `'Source Code Pro', 'Consolas', 'Inconsolata', 'Droid Sans Mono', 'Monaco', monospace'`,
    'editor.fontSize': 14,
    'editor.reuseHeaders': true,
    'editor.theme': 'dark',
    'general.betaUpdates': false,
    'prettier.printWidth': 80,
    'prettier.tabWidth': 2,
    'prettier.useTabs': false,
    'request.credentials': 'same-origin',
    'schema.disableComments': true,
    'schema.polling.enable': true,
    'schema.polling.endpointFilter': '*localhost*',
    'schema.polling.interval': 2000,
    'tracing.hideTracingResponse': true,
    'tracing.tracingSupported': true,
  },
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
    startMessage: ({ port, host, path, playgroundPath }): void => {
      serverLogger.info('listening', {
        url: `http://${Utils.prettifyHost(host)}:${port}${playgroundPath ?? path}`,
      })
    },
    playground: process.env.NODE_ENV === 'production' ? false : defaultPlaygroundSettings(),
    path: '/graphql',
  }
}

function playgroundPath(settings: true | PlaygroundSettings): string {
  if (settings === true) {
    return defaultPlaygroundPath
  }

  if (settings.path === undefined) {
    return defaultPlaygroundPath
  }

  if (settings.path.length === 0) {
    Process.fatal('Custom playground `path` cannot be empty and must start with a "/"')
  }

  if (settings.path.startsWith('/') === false) {
    log.warn('Custom playground `path` must start with a "/". Please add it.')

    return '/' + settings.path
  }

  return settings.path
}

export function playgroundSettings(settings: SettingsInput['playground']): SettingsData['playground'] {
  if (!settings) {
    return false
  }

  const clientDefaults = defaultPlaygroundSettings().clientSettings
  return {
    path: playgroundPath(settings),
    clientSettings:
      typeof settings === 'boolean' ? clientDefaults : { ...clientDefaults, ...settings.clientSettings },
  }
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
