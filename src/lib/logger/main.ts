import createPino, * as Pino from 'pino'
import * as Output from './output'
import * as Lo from 'lodash'

// TODO JSON instead of unknown type
type Context = Record<string, unknown>

export type LogRecord = {
  path: string[]
  event: string
  level: 10 | 20 | 30 | 40 | 50 | 60
  time: number
  pid: number
  hostname: string
  context: Record<string, unknown>
  v: number
}

export type Level = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace'

export type LevelNum = 60 | 50 | 40 | 30 | 20 | 10

export const LEVELS: Record<Level, { label: Level; number: LevelNum }> = {
  fatal: {
    label: 'fatal',
    number: 60,
  },
  error: {
    label: 'error',
    number: 50,
  },
  warn: {
    label: 'warn',
    number: 40,
  },

  debug: {
    label: 'info',
    number: 30,
  },
  info: {
    label: 'debug',
    number: 20,
  },
  trace: {
    label: 'trace',
    number: 10,
  },
}

export const LEVELS_BY_NUM = Object.values(LEVELS).reduce(
  (lookup, entry) => Object.assign(lookup, { [entry.number]: entry }),
  {}
) as Record<LevelNum, { label: Level; number: LevelNum }>

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
  pretty?: boolean
}

import * as Prettifier from './prettifier'

/**
 * The pino typings are poor and, for example, do not account for prettifier or
 * mixin field. Also see note from Matteo about not using them:
 * https://github.com/prisma-labs/graphql-santa/pull/244#issuecomment-572573672
 */
type ActualPinoOptions = Pino.LoggerOptions & {
  prettifier: (opts: any) => (logRec: any) => string
}

/**
 * Create a root logger.
 */
export function create(opts?: Options): RootLogger {
  const pino = createPino(
    {
      prettyPrint:
        opts?.pretty ??
        (process.env.LOG_PRETTY === 'true'
          ? true
          : process.env.LOG_PRETTY === 'false'
          ? false
          : process.stdout.isTTY),
      prettifier: (_opts: any) => Prettifier.render,
      messageKey: 'event',
    } as ActualPinoOptions,
    opts?.output ?? process.stdout
  )

  if (opts?.level) {
    pino.level = opts.level
  } else if (process.env.NODE_ENV === 'production') {
    pino.level = LEVELS.info.label
  } else {
    pino.level = LEVELS.debug.label
  }

  // TODO alt path root name is "root"... should this be configurable?
  const { logger } = createLogger(pino, ['app'], {})

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
