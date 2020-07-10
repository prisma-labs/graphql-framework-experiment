import { MaybePromise, SideEffector } from '../../lib/utils'

export type LazyState = {
  callbacks: {
    runtime: {
      before: SideEffector[]
      after: SideEffector[]
      schema: {
        before: SideEffector[]
        after: SideEffector[]
      }
    }
  }
}

function createLazyState(): LazyState {
  return {
    callbacks: {
      runtime: {
        before: [],
        after: [],
        schema: {
          before: [],
          after: [],
        },
      },
    },
  }
}

/**
 * Public component interface
 */
export interface On {
  runtime: {
    /**
     * Register a callback on the the "start" event. It is triggered when your app boots. If you return a promise it will be awaited upon.
     *
     * @tips Use this event to run initialization logic. For example, setting up a global Redis connection pool. Be mindful that since returning promises are awaited upon before starting the server, they will necessarially slow your  thus slowing down your boot time, only return a promise if you need to, as it will slow down your boot time. This mostly
     */
    before(callback: () => MaybePromise): void
    after(callback: () => MaybePromise): void
    schema: {
      before(callback: () => MaybePromise): void
      after(callback: () => MaybePromise): void
    }
  }
  // todo - requires having these calls stripped at build time for tree-shaking
  // reflect: {
  //   before(callback: () => MaybePromise): void
  //   after(callback: () => MaybePromise): void
  // }
}

/**
 * Internal component controls
 */
export interface Private {
  trigger: {
    runtime: {
      before(): Promise<void>
      after(): Promise<void>
      schema: {
        before(): Promise<void>
        after(): Promise<void>
      }
    }
  }
}

/**
 * Control this component
 */
export interface Controller {
  public: On
  private: Private
}

/**
 * Create an instance of "On"
 */
export function create(): Controller {
  const state = createLazyState()

  return {
    public: {
      runtime: {
        before(callback) {
          state.callbacks.runtime.before.push(callback)
        },
        after(callback) {
          state.callbacks.runtime.after.push(callback)
        },
        schema: {
          before(callback) {
            state.callbacks.runtime.schema.before.push(callback)
          },
          after(callback) {
            state.callbacks.runtime.schema.before.push(callback)
          },
        },
      },
    },
    private: {
      trigger: {
        runtime: {
          async before() {
            for (const callback of state.callbacks.runtime.before) {
              await callback()
            }
          },
          async after() {
            for (const callback of state.callbacks.runtime.after) {
              await callback()
            }
          },
          schema: {
            async before() {
              for (const callback of state.callbacks.runtime.schema.before) {
                await callback()
              }
            },
            async after() {
              for (const callback of state.callbacks.runtime.schema.after) {
                await callback()
              }
            },
          },
        },
      },
    },
  }
}
