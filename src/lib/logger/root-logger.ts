import * as Pino from './pino'
import * as Output from './output'
import { Level, LEVELS } from './level'
import * as Logger from './logger'

export type RootLogger = Logger.Logger & {
  setLevel: (level: Level) => RootLogger // fluent
  getLevel: () => Level
  setPretty: (pretty: boolean) => RootLogger // fluent
  isPretty: () => boolean
}

// TODO jsDoc for each option
export type Options = {
  output?: Output.Output
  level?: Level
  pretty?: boolean
  name?: string
}

export type State = {
  settings: {
    pretty: boolean
    level: Level
    output: Output.Output
  }
  pino: Pino.Logger
}

/**
 * Create a root logger.
 */
export function create(opts?: Options): RootLogger {
  const state = {
    settings: {
      pretty:
        opts?.pretty ??
        (process.env.LOG_PRETTY === 'true'
          ? true
          : process.env.LOG_PRETTY === 'false'
          ? false
          : process.stdout.isTTY),
      level:
        opts?.level ??
        (process.env.NODE_ENV === 'production'
          ? LEVELS.info.label
          : LEVELS.debug.label),

      output: opts?.output ?? process.stdout,
    },
  } as State

  state.pino = Pino.create(state.settings)

  const { logger } = Logger.create(state, [opts?.name ?? 'root'], {})

  Object.assign(logger, {
    getLevel(): Level {
      return state.settings.level
      // return state.pino.level as Level
    },
    setLevel(level: Level): Logger.Logger {
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
