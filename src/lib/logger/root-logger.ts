import * as Pino from './pino'
import * as Output from './output'
import * as Level from './level'
import * as Logger from './logger'
import { format } from 'util'

export type RootLogger = Logger.Logger & {
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
  setLevel: (level: Level.Level) => RootLogger // fluent
  getLevel: () => Level.Level
  setPretty: (pretty: boolean) => RootLogger // fluent
  isPretty: () => boolean
}

// TODO jsDoc for each option
export type Options = {
  output?: Output.Output
  /**
   * foobar
   */
  level?: Level.Level
  pretty?: boolean
  name?: string
}

export type State = {
  settings: {
    pretty: boolean
    level: Level.Level
    output: Output.Output
  }
  pino: Pino.Logger
}

/**
 * Create a root logger.
 */
export function create(opts?: Options): RootLogger {
  let level = opts?.level
  if (!level) {
    if (process.env.LOG_LEVEL) {
      level = parseFromEnvironment<Level.Level>('LOG_LEVEL', Level.parser)
    } else {
      level =
        process.env.NODE_ENV === 'production'
          ? Level.LEVELS.info.label
          : Level.LEVELS.debug.label
    }
  }

  const state = {
    settings: {
      pretty:
        opts?.pretty ??
        (process.env.LOG_PRETTY === 'true'
          ? true
          : process.env.LOG_PRETTY === 'false'
          ? false
          : process.stdout.isTTY),
      level,

      output: opts?.output ?? process.stdout,
    },
  } as State

  state.pino = Pino.create(state.settings)

  const { logger } = Logger.create(state, [opts?.name ?? 'root'], {})

  Object.assign(logger, {
    getLevel(): Level.Level {
      return state.settings.level
      // return state.pino.level as Level
    },
    setLevel(level: Level.Level): Logger.Logger {
      state.settings.level = level
      state.pino.level = level
      return logger
    },
    isPretty(): boolean {
      return state.settings.pretty
    },
    setPretty(pretty: boolean): Logger.Logger {
      state.settings.pretty = pretty
      // Pino does not support updating pretty setting, so we have to recreate it
      state.pino = Pino.create(state.settings)
      return logger
    },
  })

  return logger as RootLogger
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
