import { DeepRequired } from 'utility-types'
import { fatal } from '../../lib/process'
import { log as serverLogger } from './logger'

const log = serverLogger.child('settings')

export type PlaygroundSettings = {
  path?: string
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
  startMessage?: (address: {
    port: number
    host: string
    ip: string
    path: string
    playgroundPath?: string
  }) => void
}

export type SettingsData = Omit<DeepRequired<SettingsInput>, 'host' | 'playground'> & {
  host: string | undefined
  playground: false | Required<PlaygroundSettings>
}

export const defaultPlaygroundPath = '/'
export const defaultPlaygroundSettings: Readonly<Required<PlaygroundSettings>> = Object.freeze({
  path: defaultPlaygroundPath,
})

/**
 * The default server options. These are merged with whatever you provide. Your
 * settings take precedence over these.
 */
export const defaultSettings: Readonly<SettingsData> = Object.freeze({
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
    serverLogger.info('listening', { url: `http://${prettifyHost(host)}:${port}${playgroundPath ?? path}` })
  },
  playground: process.env.NODE_ENV === 'production' ? false : defaultPlaygroundSettings,
  path: '/graphql',
})

/**
 * Render IPv6 `::` as localhost. By default Node servers will use :: if IPv6
 * host is available otherwise IPv4 0.0.0.0. In local development it seems that
 * rendering as localhost makes the most sense as to what the user expects.
 * According to Node docs most operating systems that are supporting IPv6
 * somehow bind `::` to `0.0.0.0` anyways.
 */
function prettifyHost(host: string): string {
  return host === '::' ? 'localhost' : host
}

function playgroundPath(settings: true | PlaygroundSettings): string {
  if (settings === true) {
    return defaultPlaygroundPath
  }

  if (settings.path === undefined) {
    return defaultPlaygroundPath
  }

  if (settings.path.length === 0) {
    fatal('Custom playground `path` cannot be empty and must start with a "/"')
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

  return {
    path: playgroundPath(settings),
  }
}

function validateGraphQLPath(path: string): string {
  let outputPath = path

  if (path.length === 0) {
    fatal('Custom GraphQL `path` cannot be empty and must start with a /')
  }

  if (path.startsWith('/') === false) {
    log.warn('Custom GraphQL `path` must start with a "/". Please add it.')

    outputPath = '/' + outputPath
  }

  return outputPath
}

export function changeSettings(oldSettings: SettingsData, newSettings: SettingsInput): SettingsData {
  const outputSettings = { ...oldSettings, ...newSettings }
  const playground = playgroundSettings(outputSettings.playground)

  outputSettings.path = validateGraphQLPath(outputSettings.path)

  return {
    ...outputSettings,
    playground,
  }
}
