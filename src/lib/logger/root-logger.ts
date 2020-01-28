import * as Lo from 'lodash'
import { format } from 'util'
import * as Level from './level'
import * as Logger from './logger'
import * as Output from './output'
import * as Pino from './pino'

// todo jsdoc
export type SettingsData = {
  readonly level: Level.Level
  readonly pretty: boolean
  readonly output: Output.Output
}

export type SettingsInput = {
  /**
   * Set the level of this and all descedent loggers. This level setting has
   * highest precedence of all logger level configuration tiers.
   *
   * The level config takes the first value found, searching tiers follows:
   *
   *  1. logger instance setting
   *  2. logger constructor setting
   *  3. LOG_LEVEL environment variable setting
   *  3. NODE_ENV=production -> info
   *  4. otherwise -> debug
   */
  level?: Level.Level
  pretty?: boolean
}

type Settings = SettingsData & {
  (newSettings: SettingsInput): RootLogger
}

// TODO jsDoc for each option
export type Options = SettingsInput & {
  output?: Output.Output
  name?: string
}

export type RootLogger = Logger.Logger & {
  settings: Settings
}

export type State = {
  pino: Pino.Logger
}

/**
 * Create a root logger.
 */
export function create(opts?: Options): RootLogger {
  let level = opts?.level
  if (level === undefined) {
    if (process.env.LOG_LEVEL) {
      level = parseFromEnvironment<Level.Level>('LOG_LEVEL', Level.parser)
    } else {
      level =
        process.env.NODE_ENV === 'production'
          ? Level.LEVELS.info.label
          : Level.LEVELS.debug.label
    }
  }
  const pretty =
    opts?.pretty ??
    (process.env.LOG_PRETTY === 'true'
      ? true
      : process.env.LOG_PRETTY === 'false'
      ? false
      : process.stdout.isTTY)

  const state = {} as State
  const loggerLink = Logger.create(state, [opts?.name ?? 'root'], {})
  const logger = loggerLink.logger as RootLogger

  logger.settings = ((newSettings: SettingsInput) => {
    Lo.merge(logger.settings, newSettings)

    if (newSettings.pretty !== undefined) {
      // Pino does not support updating pretty setting, so we have to recreate it
      state.pino = Pino.create(logger.settings)
    }

    if (newSettings.level !== undefined) {
      state.pino.level = newSettings.level
    }

    return logger
  }) as Settings

  Object.assign(logger.settings, {
    pretty,
    level,
    output: opts?.output ?? process.stdout,
  })

  state.pino = Pino.create(logger.settings)

  return logger
}

/**
 * Run a given parser over an environment variable. If parsing fails, throw a
 * contextual error message.
 */
function parseFromEnvironment<T>(
  key: string,
  parser: {
    info: { valid: string; typeName: string }
    run: (raw: string) => null | T
  }
): T {
  const envVarValue = process.env[key]! // assumes env presence handled before
  const result = parser.run(envVarValue)

  if (result === null) {
    throw new Error(
      `Could not parse environment variable ${key} into ${
        parser.info.typeName
      }. The environment variable was: ${format(
        envVarValue
      )}. A valid environment variable must be like: ${parser.info.valid}`
    )
  }

  return result
}
