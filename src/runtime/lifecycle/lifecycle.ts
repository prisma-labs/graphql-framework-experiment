import * as NexusSchema from '@nexus/schema'
import { rootLogger } from '../../lib/nexus-logger'

const log = rootLogger.child('lifecycle')

type Data = {
  schema: NexusSchema.core.NexusGraphQLSchema
}

type Callback = (data: Data) => void

export type LazyState = {
  callbacks: {
    start: Callback[]
  }
}

function createLazyState(): LazyState {
  return {
    callbacks: {
      start: [],
    },
  }
}

/**
 * Public component interface
 */
export interface Lifecycle {
  start(callback: (data: Data) => void): void
  // idea - if we ever need it
  // phase: {
  //   now: 'reflection' | 'runtime'
  //   reflection: boolean
  //   runtime: boolean
  // }
  // todo
  // stage: {
  //   now: 'production' | 'development'
  // }
  // todo - requires having calls be stripped at build time for tree-shaking
  // reflection: {}
}

/**
 * Internal component controls
 */
export interface Private {
  trigger: {
    start(data: Data): void
  }
}

/**
 * Create an instance of Lifecycle
 */
export function create() {
  const state = createLazyState()

  const api = {} as Lifecycle

  api.start = function (callback) {
    log.debug('registered callback', { event: 'start' })
    state.callbacks.start.push(callback)
  }

  return {
    public: api,
    private: {
      trigger: {
        start(data) {
          for (const callback of state.callbacks.start) {
            log.debug('will run callback', { event: 'start' })
            try {
              callback(data)
            } catch (error) {
              const wrappedError = new Error(
                `Lifecycle callback error on event "runtime.start.before":\n\n${error.message}`
              )
              wrappedError.stack = error.stack
              throw wrappedError
            }
            log.debug('did run callback', { event: 'start' })
          }
        },
      },
    } as Private,
  }
}
