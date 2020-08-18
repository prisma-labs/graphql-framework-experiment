// Not using ECMA modules b/c TS autoformat moves it down but we need it first
// for side-effects.
require('../tty-linker').create().child.install()

import * as DevMode from '../../runtime/dev-mode'
import { rootLogger } from '../nexus-logger'
import hook from './hook'
import * as IPC from './ipc'

const log = rootLogger.child('dev').child('runner')

main()

async function main() {
  if (process.env.ENTRYPOINT_SCRIPT === undefined) {
    throw new Error('process.env.ENTRYPOINT_SCRIPT needs to be defined')
  }

  // Enable dev mode code paths for IPC interaction
  process.env[DevMode.DEV_MODE_ENV_VAR_NAME] = 'true'

  // TODO perhaps we should move these unhandled error/rejections
  // to start module because we probably want them just as much from production as
  // we do for development.

  // Error handler that displays a notification and logs the stack to stderr:

  let caught = false
  process.on('uncaughtException', function (err) {
    // Handle exepection only once
    if (caught) return
    caught = true
    // If there's a custom uncaughtException handler expect it to terminate
    // the process.
    const hasCustomHandler = process.listeners('uncaughtException').length > 1
    const isTsError = err.message && /TypeScript/.test(err.message)
    if (!hasCustomHandler && !isTsError) {
      console.error(err.stack || err)
    }
    const errorMessage = {
      error: isTsError ? '' : err.name || 'Error',
      stack: err.stack,
      willTerminate: hasCustomHandler,
    }
    log.trace('uncaughtException ', { errorMessage })
    IPC.client.senders.error(errorMessage)
  })

  // unhandled rejection will get whatever value the user rejected with, which
  // could be anything, sadly.
  //
  let rejected = false
  process.on('unhandledRejection', function (err: any) {
    // Handle exepection only once
    if (rejected) return
    rejected = true
    const stack = err?.stack ?? ''
    const name = err?.name ?? 'Error'
    const message = err?.message ?? ''
    // If there's a custom uncaughtException handler expect it to terminate
    // the process.
    // TODO we should not ASSUME that it will terminate...unless our framework
    // guarantees that :)
    const hasCustomHandler = process.listeners('unhandledRejection').length > 1
    const isTsError = /TypeScript/.test(message)
    if (!hasCustomHandler && !isTsError) {
      console.error(stack || err)
    }
    const errorData = {
      error: isTsError ? '' : name,
      stack,
      willTerminate: hasCustomHandler,
    }
    log.trace('unhandledRejection', { errorData })
    IPC.client.senders.error(errorData)
  })

  // Hook into require() and notify the parent process about required files
  hook(module, (filePath) => {
    IPC.client.senders.moduleImported({ filePath })
  })

  eval(process.env.ENTRYPOINT_SCRIPT)
}
