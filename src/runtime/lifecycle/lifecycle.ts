import { rootLogger } from '../../lib/nexus-logger'
import { isReflection } from '../../lib/reflection'
import { SideEffector } from '../../lib/utils'

const log = rootLogger.child('lifecycle')

export type LazyState = {
  callbacks: {
    runtime: {
      start: {
        before: SideEffector[]
      }
      // todo
      // after: SideEffector[]
      // schema: {
      //   before: SideEffector[]
      //   after: SideEffector[]
      // }
    }
  }
}

function createLazyState(): LazyState {
  return {
    callbacks: {
      runtime: {
        start: {
          before: [],
        },
        // todo
        // after: [],
        // schema: {
        //   before: [],
        //   after: [],
        // },
      },
    },
  }
}

/**
 * Public component interface
 */
export interface Lifecycle {
  runtime: {
    (callback: () => void): void
    now: boolean
  }
  // todo
  // stage: {
  //   now: 'production' | 'development'
  // }
  // todo - requires having calls be stripped at build time for tree-shaking
  // reflect: {}
}

/**
 * Internal component controls
 */
export interface Private {
  trigger: {
    runtime: {
      start: {
        before(): Promise<void>
        // todo
        // after(): Promise<void>
        // schema: {
        //   before(): Promise<void>
        //   after(): Promise<void>
        // }
      }
    }
  }
}

/**
 * Create an instance of Lifecycle
 */
export function create() {
  const state = createLazyState()

  const api = {} as Lifecycle

  api.runtime = function (callback) {
    log.debug('registered callback')
    state.callbacks.runtime.start.before.push(callback)
  } as Lifecycle['runtime']

  api.runtime.now = !isReflection()

  return {
    public: api,
    private: {
      trigger: {
        runtime: {
          start: {
            before() {
              for (const callback of state.callbacks.runtime.start.before) {
                // todo error handling
                log.debug('will run callback', { event: 'runtime.start.before' })
                try {
                  callback()
                } catch (error) {
                  const wrappedError = new Error(
                    `Lifecycle callback error on event "runtime.start.before":\n\n${error.message}`
                  )
                  wrappedError.stack = error.stack
                  throw wrappedError
                }
                log.debug('did run callback', { event: 'runtime.start.before' })
              }
            },
          },

          // todo
          // async after() {
          //   for (const callback of state.callbacks.runtime.after) {
          //     await callback()
          //   }
          // },
          // schema: {
          //   async before() {
          //     for (const callback of state.callbacks.runtime.schema.before) {
          //       await callback()
          //     }
          //   },
          //   async after() {
          //     for (const callback of state.callbacks.runtime.schema.after) {
          //       await callback()
          //     }
          //   },
          // },
        },
      },
    },
  }
}
