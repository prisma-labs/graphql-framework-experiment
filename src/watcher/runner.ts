import { register } from 'ts-node'
import * as ts from 'typescript'
import { Script } from 'vm'
import * as Layout from '../framework/layout'
import { extractContextTypes, readTsConfig } from '../utils'
import { rootLogger } from '../utils/logger'
import cfgFactory from './cfg'
import hook from './hook'
import * as IPC from './ipc'
import Module = require('module')

const log = rootLogger
  .child('cli')
  .child('dev')
  .child('runner')

log.trace('boot')

// TODO HACK, big one, like running ts-node twice?
register({
  transpileOnly: true,
})
;(async function() {
  await IPC.client.connect()
  log.trace('starting context type extraction')
  const layout = await Layout.loadDataFromParentProcess()
  const tsConfig = readTsConfig(layout)
  const program = ts.createIncrementalProgram({
    rootNames: tsConfig.fileNames,
    options: {
      incremental: true,
      tsBuildInfoFile: './node_modules/.nexus/cache.tsbuildinfo',
      ...tsConfig.options,
    },
  })
  process.env.NEXUS_TYPEGEN_ADD_CONTEXT_RESULTS = JSON.stringify(
    extractContextTypes(program)
  )
  log.trace('finished context type extraction')

  // Remove app-runner.js from the argv array
  process.argv.splice(1, 1)

  // A signal that the framework can use to make integrity checks with
  process.env.NEXUS_DEV_MODE = 'true'

  if (process.env.DEBUG_RUNNER) {
    process.env.DEBUG = process.env.DEBUG_RUNNER
  }

  const cfg = cfgFactory()
  const cwd = process.cwd()

  // Set NODE_ENV to 'development' unless already set
  if (!process.env.NODE_ENV) process.env.NODE_ENV = 'development'

  if (process.env.NODE_DEV_PRELOAD) {
    require(process.env.NODE_DEV_PRELOAD)
  }

  // Listen SIGTERM and exit unless there is another listener
  process.on('SIGTERM', function() {
    if (process.listeners('SIGTERM').length === 1) {
      log.trace('Child got SIGTERM, exiting')
      process.exit(0)
    }
  })

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
  process.on('uncaughtException', function(err) {
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
  process.on('unhandledRejection', function(err: any) {
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
  hook(cfg, module, filePath => {
    IPC.client.senders.moduleImported({ filePath })
  })

  if (!process.env.NEXUS_EVAL) {
    throw new Error('process.env.NEXUS_EVAL is required')
  }

  evalScript(process.env.NEXUS_EVAL)

  function evalScript(script: string) {
    const EVAL_FILENAME = process.env.NEXUS_EVAL_FILENAME!
    const module = new Module(EVAL_FILENAME)
    module.filename = EVAL_FILENAME
    module.paths = (Module as any)._nodeModulePaths(cwd)
    ;(global as any).__filename = EVAL_FILENAME
    ;(global as any).__dirname = cwd
    ;(global as any).exports = module.exports
    ;(global as any).module = module
    ;(global as any).require = module.require.bind(module)

    new Script(script, {
      filename: EVAL_FILENAME,
    }).runInThisContext()
  }
})()
