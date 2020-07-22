import * as NexusSchema from '@nexus/schema'
import { rootLogger } from '../../lib/nexus-logger'
import { AppState } from '../app'

const log = rootLogger.child('lifecycle')

/**
 * The data we pass to callbacks
 */
type Data = {
  schema: NexusSchema.core.NexusGraphQLSchema
}

/**
 * The function users can register
 */
type Callback = (data: Data) => void

export type LazyState = {
  callbacks: {
    start: Callback[]
  }
}

export function createLazyState(): LazyState {
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
  /**
   * Register callback to be run when the application starts.
   *
   * @remarks
   *
   * Put initialization code here that you don't want run during [Nexus reflection](https://nxs.li/about/reflection).
   */
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
  reset(): void
  trigger: {
    start(data: Data): void
  }
}

/**
 * Control the Lifecycle component
 */
export interface Controller {
  public: Lifecycle
  private: Private
}

/**
 * Create an instance of Lifecycle
 */
export function create(state: AppState): Controller {
  state.components.lifecycle = createLazyState()

  const api = {} as Lifecycle

  api.start = function (callback) {
    log.debug('registered callback', { event: 'start' })
    state.components.lifecycle.callbacks.start.push(callback)
  }

  return {
    public: api,
    private: {
      reset() {
        state.components.lifecycle.callbacks.start.length = 0
      },
      trigger: {
        start(data) {
          for (const callback of state.components.lifecycle.callbacks.start) {
            log.debug('will run callback', { event: 'start' })
            try {
              callback(data)
            } catch (error) {
              const wrappedError = new Error(`Lifecycle callback error on event "start":\n\n${error.message}`)
              wrappedError.stack = error.stack
              throw wrappedError
            }
            log.debug('did run callback', { event: 'start' })
          }
        },
      },
    },
  }
}
