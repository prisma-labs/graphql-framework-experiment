import { format } from 'util'
import { casesHandled } from '../utils'
import { chalk } from './chalk'
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
    levelLabel: boolean
    timeDiff: boolean
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
   * When `undefined` pretty takes the first value found, in order:
   *
   *  1. `process.env.LOG_PRETTY` (admits case insensitive: `true` | `false`)
   *  2. `process.stdout.isTTY`
   */
  pretty?:
    | boolean
    | {
        /**
         * Disable or enable pretty mode.
         *
         * When `undefined` pretty takes the first value found, in order:
         *
         *  1. `process.env.LOG_PRETTY` (admits case insensitive: `true` | `false`)
         *  2. `process.stdout.isTTY`
         */
        enabled?: boolean
        /**
         * Should logs be colored?
         *
         * @default `true`
         *
         * Disabling can be useful when pretty logs are going to a destination that
         * does not support rendering ANSI color codes (consequence being very
         * difficult to read content).
         */
        color?: boolean
        /**
         * Should logs include the level label?
         *
         * @default `false`
         *
         * Enable this if understanding the level of a log is important to you
         * and the icon+color system is insufficient for you to do so. Can be
         * helpful for newcomers or a matter of taste for some.
         */
        levelLabel?: boolean
        /**
         * Should the logs include the time between it and previous log?
         *
         * @default `true`
         */
        timeDiff?: boolean
      }
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

    // sync chalk
    if ('pretty' in newSettings) {
      // todo do not assume true color support
      // https://github.com/chalk/chalk#256-and-truecolor-color-support
      chalk.level = newSettings.pretty ? 3 : 0
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
  // todo no semantic to "unset back to default"
  // consider using `null` for that purpose...
  const color =
    (typeof pretty === 'object' ? pretty.color : undefined) ??
    previous?.color ??
    true

  const enabled =
    (typeof pretty === 'object' ? pretty.enabled : undefined) ??
    previous?.enabled ??
    // todo nice is-defined-but-parse-error feedback
    (process.env.LOG_PRETTY?.toLowerCase() === 'true'
      ? true
      : process.env.LOG_PRETTY?.toLowerCase() === 'false'
      ? false
      : process.stdout.isTTY)

  const levelLabel =
    (typeof pretty === 'object' ? pretty.levelLabel : undefined) ??
    previous?.levelLabel ??
    false

  const timeDiff =
    (typeof pretty === 'object' ? pretty.timeDiff : undefined) ??
    previous?.timeDiff ??
    true

  if (pretty === undefined) {
    return { enabled, color, levelLabel, timeDiff }
  }

  if (pretty === true) {
    return { enabled: true, color, levelLabel, timeDiff }
  }

  if (pretty === false) {
    return { enabled: false, color, levelLabel, timeDiff }
  }

  if (typeof pretty === 'object') {
    return { enabled, color, levelLabel, timeDiff }
  }

  casesHandled(pretty)
}
