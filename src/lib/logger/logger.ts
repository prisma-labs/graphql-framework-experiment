import * as Lo from 'lodash'
import { Level } from './level'
import * as RootLogger from './root-logger'

// TODO JSON instead of unknown type
type Context = Record<string, unknown>

export type LogRecord = {
  path: string[]
  event: string
  level: 10 | 20 | 30 | 40 | 50 | 60
  time: number
  pid: number
  hostname: string
  context: Context
  v: number
}

type Log = (event: string, context?: Context) => void

export type Logger = {
  fatal: Log
  error: Log
  warn: Log
  info: Log
  debug: Log
  trace: Log
  addToContext: (context: Context) => Logger // fluent
  child: (name: string) => Logger // fluent
}

/**
 * Create a logger.
 */
export function create(
  rootState: RootLogger.State,
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
    state.children.forEach((child) => {
      child.onNewParentContext(state.pinnedAndParentContext)
    })
  }

  function forwardToPino(level: Level, event: string, localContext: undefined | Context) {
    // Avoid mutating the passed local context
    const context = localContext
      ? Lo.merge({}, state.pinnedAndParentContext, localContext)
      : state.pinnedAndParentContext

    rootState.pino[level]({ path, context }, event)
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
      const { logger: child, link } = create(rootState, path.concat([name]), state.pinnedAndParentContext)
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
