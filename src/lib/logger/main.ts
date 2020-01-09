import createPino, * as Pino from 'pino'
import * as Output from './output'
import * as Lo from 'lodash'

// TODO JSON instead of unknown type
type Context = Record<string, unknown>

type Level = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace'

const LEVELS = {
  fatal: 'fatal',
  error: 'error',
  debug: 'debug',
  warn: 'warn',
  trace: 'trace',
  info: 'info',
} as const

type Log = (event: string, context?: Context) => void

export type Logger = {
  fatal: Log
  error: Log
  warn: Log
  info: Log
  debug: Log
  trace: Log
  addToContext: (context: Context) => Logger // fluent
  child: (name: string) => Logger
}

export type RootLogger = Logger & {
  setLevel: (level: Level) => RootLogger
  getLevel: () => Level
}

export type Options = {
  output?: Output.Output
  level?: Level
}

/**
 * Create a root logger.
 */
export function create(opts?: Options): RootLogger {
  const pino = createPino(
    {
      messageKey: 'event',
    },
    opts?.output ?? process.stdout
  )

  if (opts?.level) {
    pino.level = opts.level
  } else if (process.env.NODE_ENV === 'production') {
    pino.level = LEVELS.info
  } else {
    pino.level = LEVELS.debug
  }

  const { logger } = createLogger(pino, ['root'], {})

  Object.assign(logger, {
    getLevel(): Level {
      return pino.level as Level
    },
    setLevel(level: Level): Logger {
      pino.level = level
      return logger
    },
  })

  return logger as RootLogger
}

/**
 * Create a logger.
 */
export function createLogger(
  pino: Pino.Logger,
  path: string[],
  parentContext: Context
): { logger: Logger; link: Link } {
  const state: State = {
    // Copy as addToContext will mutate it
    pinnedAndParentContext: Lo.cloneDeep(parentContext),
    children: [],
  }

  function updateContextAndPropagate(newContext: Context) {
    state.pinnedAndParentContext = newContext
    state.children.forEach(child => {
      child.onNewParentContext(state.pinnedAndParentContext)
    })
  }

  function forwardToPino(
    level: Level,
    event: string,
    localContext: undefined | Context
  ) {
    // Avoid mutating the passed local context
    const context = localContext
      ? Lo.merge({}, state.pinnedAndParentContext, localContext)
      : state.pinnedAndParentContext

    pino[level]({ path, context }, event)
  }

  const link: Link = {
    onNewParentContext(newParentContext: Context) {
      updateContextAndPropagate(
        Lo.merge(
          // Copy so that we don't mutate parent while maintaining local overrides...
          {},
          newParentContext,
          // ...this
          state.pinnedAndParentContext
        )
      )
    },
  }

  const logger: Logger = {
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
    addToContext(context: Context) {
      // Can safely mutate here, save some electricity...
      updateContextAndPropagate(Lo.merge(state.pinnedAndParentContext, context))
      return logger
    },
    child: (name: string): Logger => {
      const { logger: child, link } = createLogger(
        pino,
        path.concat([name]),
        state.pinnedAndParentContext
      )
      state.children.push(link)
      return child
    },
  }

  return {
    logger,
    link,
  }
}

type Link = {
  onNewParentContext: (newContext: Context) => void
}

type State = {
  pinnedAndParentContext: Context
  children: Link[]
}
