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

// Remove app-runner.js from the argv array
process.argv.splice(1, 1)

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
  ipc.send({
    error: isTsError ? '' : err.name || 'Error',
    stack: err.stack,
    willTerminate: hasCustomHandler,
  })
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
