import createPino, { levels } from 'pino'
import * as Output from './output'
import * as Lo from 'lodash'

// TODO JSON instead of unknown type
type Context = Record<string, unknown>

type Log = (event: string, context?: Context) => void
type LevelLog = (level: Level, event: string, context?: Context) => void

type Level = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace'

const LEVELS = {
  fatal: 'fatal',
  error: 'error',
  debug: 'debug',
  warn: 'warn',
  trace: 'trace',
  info: 'info',
} as const

export type Options = {
  output?: Output.Output
}

export type Logger = {
  fatal: Log
  error: Log
  warn: Log
  info: Log
  debug: Log
  trace: Log
  level: Level
  addToContext: (context: Context) => void
}

export function create(opts?: Options): Logger {
  const state = {
    pinnedContext: {},
  } as { pinnedContext: Context }

  const pino = createPino(
    {
      messageKey: 'event',
    },
    opts?.output ?? process.stdout
  )

  if (process.env.NODE_ENV === 'production') {
    pino.level = LEVELS.info
  } else {
    pino.level = LEVELS.debug
  }

  const forwardToPino: LevelLog = (level, event, localContext) => {
    // Avoid mutating the passed local context
    const context = Lo.merge({}, state.pinnedContext, localContext)
    pino[level]({ context }, event)
  }

  return {
    get level() {
      return pino.level as Level
    },
    set level(level: Level) {
      pino.level = level
    },
    addToContext(context: Context) {
      Lo.merge(state.pinnedContext, context)
    },
    fatal(event, context) {
      forwardToPino('fatal', event, context)
    },
    error(event, context) {
      forwardToPino('error', event, context)
    },
    warn(event, context) {
      forwardToPino('warn', event, context)
    },
    info(event, context) {
      forwardToPino('info', event, context)
    },
    debug(event, context) {
      forwardToPino('debug', event, context)
    },
    trace(event, context) {
      forwardToPino('trace', event, context)
    },
  }
}
