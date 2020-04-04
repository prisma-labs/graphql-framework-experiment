/**
 * This module provides a node process exit system wherein any part of the
 * program can reliably hook onto program exit and run some cleanup which will
 * be await upon up to a given grace period.
 */

import * as lo from 'lodash'
import { log } from './nexus-logger'

type BeforeExiter = () => Promise<unknown>

declare global {
  namespace NodeJS {
    interface Process {
      _exitSystem: {
        beforeExiters: BeforeExiter[]
        isExiting: boolean
        settings: Required<Options>
      }
      onBeforeExit(cb: BeforeExiter): void
    }
  }
}

interface Options {
  /**
   * Time limit in milliseconds that registered tearndown functions have to
   * complete their work.
   *
   * @default 2000
   */
  timeLimit?: number
}

/**
 * Module state to track if install has been called before calls to exit take place.
 */
let installed = false

/**
 * Augment the global process object with a `onBeforeExit` registrater function
 * and register exit callbacks on SIGTERM and SIGINT.
 * @param options
 */
export function install(options?: Options): void {
  installed = true
  process.once('SIGTERM', () => exit(0))
  process.once('SIGINT', () => exit(0))
  process._exitSystem = {
    beforeExiters: [],
    isExiting: false,
    settings: lo.merge({}, { timeLimit: 2000 }, options),
  }
  process.onBeforeExit = (cb: BeforeExiter): void => {
    process._exitSystem.beforeExiters.push(cb)
  }
}

/**
 * Begin program exit, calling all regisered before-exit functions before
 * finally doing so. This can only be called once within a process's life.
 * Subsequent calls are a no-op.
 */
export async function exit(exitCode: number): Promise<void> {
  if (!installed) {
    throw new Error('ExitSystem exit called but it has not been installed.')
  }

  log.trace('exiting', {
    beforeExitersCount: process._exitSystem.beforeExiters.length,
  })

  if (process._exitSystem.isExiting) return

  process._exitSystem.isExiting = true

  try {
    await Promise.race([
      new Promise((res) => {
        // todo send SIGKILL to process tree...
        setTimeout(() => {
          log.warn('time expired before all before-exit teardowns completed')
          res()
        }, process._exitSystem.settings.timeLimit)
      }),
      Promise.all(process._exitSystem.beforeExiters.map((f) => f())),
    ])
  } catch (e) {
    console.error(e)
    // If exiting with an already already, preserve that
    process.exit(exitCode > 0 ? exitCode : 1)
  }

  process.exit(exitCode)
}
