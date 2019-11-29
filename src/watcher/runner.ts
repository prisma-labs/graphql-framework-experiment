// HACK force the process to think it has a tty. We know it will not becuse of
// the way runner is run by watcher, wherein fork is run so that child object in
// parent process has programatic stream control over stdin/out/err. This is to support
// co-existence with dev mode UI where we want the user to be able to toggle
// bewteen viewing their logs and the UI. It is assumed that watcher will always
// be running with a tty but it would be a matter of invoking runner with some
// additional special args if this constant ever becomes variable.
require('tty').isatty = () => true
process.stdout.isTTY = true
process.stderr.isTTY = true

import { fork } from 'child_process'
import hook from './hook'
import * as ipc from './ipc'
const childProcess = require('child_process')
import cfgFactory from './cfg'
import { Script } from 'vm'
import Module = require('module')
import { pog } from '../utils'
import { register } from 'ts-node'

register({
  transpileOnly: true,
})

// Remove app-runner.js from the argv array
process.argv.splice(1, 1)

// A signal that the framework can use to make integrity checks with
process.env.PUMPKINS_DEV_MODE = 'true'

if (process.env.DEBUG_RUNNER) {
  process.env.DEBUG = process.env.DEBUG_RUNNER
}

const log = pog.sub('cli:dev:runner')
const cfg = cfgFactory()
const cwd = process.cwd()

// Set NODE_ENV to 'development' unless already set
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'development'

if (process.env.NODE_DEV_PRELOAD) {
  require(process.env.NODE_DEV_PRELOAD)
}

// Listen SIGTERM and exit unless there is another listener
process.on('SIGTERM', function() {
  if (process.listeners('SIGTERM').length === 1) process.exit(0)
})

if (cfg.fork) {
  // Overwrite child_process.fork() so that we can hook into forked processes
  // too. We also need to relay messages about required files to the parent.
  childProcess.fork = function(modulePath: string, args: any, options: any) {
    const child = fork(__filename, [modulePath].concat(args), options)
    ipc.relay(child)
    return child
  }
}

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
  log('uncaughtException %O', errorMessage)
  ipc.send(errorMessage)
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
  const errorMessage = {
    error: isTsError ? '' : name,
    stack,
    willTerminate: hasCustomHandler,
  }
  log('unhandledRejection %O', errorMessage)
  ipc.send(errorMessage)
})

// Hook into require() and notify the parent process about required files
hook(cfg, module, file => {
  ipc.send({ required: file })
})

if (!process.env.PUMPKINS_EVAL) {
  throw new Error('process.env.PUMPKINS_EVAL is required')
}

evalScript(process.env.PUMPKINS_EVAL)

function evalScript(script: string) {
  const EVAL_FILENAME = process.env.PUMPKINS_EVAL_FILENAME!
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
