// Not using ECMA modules b/c TS autoformat moves it down but we need it first
// for side-effects.
require('../tty-linker').create().child.install()

import * as tsNode from 'ts-node'
import { createDevAppRunner } from '../../runtime/start'
import { runAddToContextExtractorAsWorkerIfPossible } from '../add-to-context-extractor/add-to-context-extractor'
import * as Layout from '../layout'
import { rootLogger } from '../nexus-logger'
import cfgFactory from './cfg'
import hook from './hook'
import * as IPC from './ipc'

const log = rootLogger.child('dev').child('runner')

tsNode.register({
  transpileOnly: true,
})

main()

async function main() {
  const layout = Layout.mustLoadDataFromParentProcess()

  runAddToContextExtractorAsWorkerIfPossible(layout.data)

  // Remove app-runner.js from the argv array
  // todo why?
  process.argv.splice(1, 1)

  // Enable dev mode code paths for IPC interaction
  process.env.NEXUS_DEV_MODE = 'true'

  const cfg = cfgFactory()

  // Set NODE_ENV to 'development' unless already set
  if (!process.env.NODE_ENV) process.env.NODE_ENV = 'development'

  if (process.env.NODE_DEV_PRELOAD) {
    require(process.env.NODE_DEV_PRELOAD)
  }

  // // Listen SIGTERM and exit unless there is another listener
  // process.on('SIGTERM', function() {
  //   if (process.listeners('SIGTERM').length === 1) {
  //     log.trace('Child got SIGTERM, exiting')
  //     process.exit(0)
  //   }
  // })

  // Overwrite child_process.fork() so that we can hook into forked processes
  // too. We also need to relay messages about required files to the parent.
  // childProcess.fork = function(modulePath: string, args: any, options: any) {
  //   const child = fork(__filename, [modulePath].concat(args), options)
  //   // ipc.relay(child)
  //   return child
  // }

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
  hook(cfg, module, (filePath) => {
    IPC.client.senders.moduleImported({ filePath })
  })

  const appRunner = createDevAppRunner(layout)

  return appRunner.start()
}
