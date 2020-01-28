import { format } from 'util'
import { casesHandled } from '../utils'
import * as Level from './level'
import * as Logger from './logger'
import * as Output from './output'
import * as Pino from './pino'

// todo jsdoc
export type SettingsData = Readonly<{
  level: Level.Level
  pretty: Readonly<{
    enabled: boolean
    color: boolean
  }>
  output: Output.Output
}>

export type SettingsInput = {
  /**
   * Set the level of this and all descedent loggers. This level setting has
   * highest precedence of all logger level configuration tiers.
   *
   * The level config takes the first value found, searching tiers as follows:
   *
   *  1. logger instance setting
   *  2. logger constructor setting
   *  3. LOG_LEVEL environment variable setting
   *  3. NODE_ENV=production -> info
   *  4. otherwise -> debug
   */
  level?: Level.Level
  /**
   * Control pretty mode.
   *
   * Shorthands:
   *
   *  - `true` is shorthand for `{ enabled: true }`
   *  - `false` is shorthand for `{ enabled: false }`
   *
   * The pretty config takes the first value found, searching tiers as follows:
   *
   *  1. logger instance settings
   *  2. logger construction settings
   *  3. LOG_PRETTY environment variable
   *  4. otherwise -> process.stdout.isTTY
   */
  pretty?: boolean | { enabled: boolean; color?: boolean }
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
  const isPrettyEnabled =
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
    if ('pretty' in newSettings) {
      // @ts-ignore
      logger.settings.pretty = processSettingInputPretty(
        newSettings.pretty,
        logger.settings.pretty
      )
    }

    if ('level' in newSettings) {
      // @ts-ignore
      logger.settings.level = newSettings.level
    }

    // sync pino

    if ('pretty' in newSettings) {
      // Pino does not support updating pretty setting, so we have to recreate it
      state.pino = Pino.create(logger.settings)
    }

    if ('level' in newSettings) {
      state.pino.level = logger.settings.level
    }

    return logger
  }) as Settings

  Object.assign(logger.settings, {
    pretty: processSettingInputPretty(opts?.pretty, null),
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

/**
 * Process pretty setting input.
 */
function processSettingInputPretty(
  pretty: SettingsInput['pretty'],
  previous: null | SettingsData['pretty']
): SettingsData['pretty'] {
  const color = previous?.color ?? true

  if (pretty === undefined) {
    return {
      enabled:
        process.env.LOG_PRETTY === 'true'
          ? true
          : process.env.LOG_PRETTY === 'false'
          ? false
          : process.stdout.isTTY,
      color,
    }
  }

  if (pretty === true) {
    return { enabled: true, color }
  }

  if (pretty === false) {
    return { enabled: false, color }
  }

  if (typeof pretty === 'object') {
    return {
      enabled: pretty.enabled,
      color,
    }
  }

  casesHandled(pretty)
}
