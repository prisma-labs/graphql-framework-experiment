import { fork } from 'child_process'
import * as fs from 'fs'
import { compiler } from './compiler'
import * as ipc from './ipc'
import { Opts, Process } from './types'
import cfgFactory from './cfg'
import { pog } from '../utils'
const filewatcher = require('filewatcher')
const treeKill = require('tree-kill')

const log = pog.sub('watcher')

/**
 * Entrypoint into the watcher system.
 */
export function createWatcher(opts: Opts) {
  const cfg = cfgFactory(opts)

  compiler.init(opts)
  compiler.stop = stopRunner

  // Run ./dedupe.js as preload script
  if (cfg.dedupe) process.env.NODE_DEV_PRELOAD = __dirname + '/dedupe'

  //
  // Setup State
  //

  // Create a file watcher
  const watcher = filewatcher({
    forcePolling: opts.poll,
    interval: parseInt(opts.interval!, 10),
    debounce: parseInt(opts.debounce!, 10),
    recursive: true,
  })

  watcher.on('change', (file: string, isManualRestart: boolean) => {
    log('file watcher change event')
    restartRunner(runner, file, isManualRestart)
  })

  watcher.on('fallback', function(limit: number) {
    log('file watcher fallback event')
    console.warn(
      'node-dev ran out of file handles after watching %s files.',
      limit
    )
    console.warn('Falling back to polling which uses more CPU.')
    console.info('Run ulimit -n 10000 to increase the file descriptor limit.')
    if (cfg.deps)
      console.info('... or add `--no-deps` to use less file handles.')
  })

  // Create a mutable runner
  let runner = startRunnerDo()

  // Create some state to dedupe restarts. For example a rapid succession of
  // file changes will not trigger restart multiple times while the first
  // invocation was still running to completion.
  let runnerRestarting = false

  // Relay SIGTERM
  process.on('SIGTERM', () => {
    log('Process got SIGTERM')
    killChild(runner, { treeKill: opts['tree-kill'] ?? false })
    process.exit(0)
  })

  function startRunnerDo(): Process {
    return startRunner(opts, cfg, watcher, {
      onError: willTerminate => {
        stopRunner(runner, willTerminate)
      },
    })
  }

  function stopRunner(child: Process, willTerminate?: boolean) {
    if (child.exited || child.stopping) {
      return
    }
    child.stopping = true
    child.respawn = true
    if (child.connected === undefined || child.connected === true) {
      log('Disconnecting from child')
      child.disconnect()
      if (!willTerminate) {
        killChild(child, { treeKill: opts['tree-kill'] ?? false })
      }
    }
  }

  function restartRunner(
    child: Process,
    file: string,
    isManualRestart: boolean
  ) {
    if (file === compiler.tsConfigPath) {
      log('reinitializing TS compilation')
      compiler.init(opts)
    }
    /* eslint-disable no-octal-escape */
    if (cfg.clear) process.stdout.write('\\033[2J\\033[H')
    if (isManualRestart === true) {
      log('restarting manual restart from user')
    } else {
      log('Restarting %s has been modified')
    }
    compiler.compileChanged(file, opts.callbacks ?? {})
    if (runnerRestarting) {
      log('already starting')
      return
    }
    log('removing all watchers from files')
    watcher.removeAll()
    runnerRestarting = true
    if (!runner.exited) {
      log('runner is still executing, will restart upon its exit')
      runner.on('exit', () => {
        runner = startRunnerDo()
        runnerRestarting = false
      })
      stopRunner(runner)
    } else {
      log('runner already exited, probably due to a previous error')
      runner = startRunnerDo()
      runnerRestarting = false
    }
  }
}

/**
 * Returns the nesting-level of the given module.
 * Will return 0 for modules from the main package or linked modules,
 * a positive integer otherwise.
 */
function getLevel(mod: string) {
  const p = getPrefix(mod)

  return p.split('node_modules').length - 1
}

/**
 * Returns the path up to the last occurence of `node_modules` or an
 * empty string if the path does not contain a node_modules dir.
 */
function getPrefix(mod: string) {
  const n = 'node_modules'
  const i = mod.lastIndexOf(n)

  return ~i ? mod.slice(0, i + n.length) : ''
}

function isPrefixOf(value: string) {
  return function(prefix: string) {
    return value.indexOf(prefix) === 0
  }
}

function isRegExpMatch(value: string) {
  return function(regExp: string) {
    return new RegExp(regExp).test(value)
  }
}

/**
 * Kill the child using tree kill or vanilla sigterm.
 */
function killChild(child: Process, opts: { treeKill: boolean }) {
  if (child.exited) return

  log('sending SIGTERM kill to child pid %s', child.pid)

  if (opts.treeKill) {
    log('using tree-kill')
    treeKill(child.pid)
  } else {
    child.kill('SIGTERM')
  }
}

/**
 * Start the App Runner. This occurs once on boot and then on every subsequent
 * file change in the users's project.
 */
function startRunner(
  opts: Opts,
  cfg: ReturnType<typeof cfgFactory>,
  watcher: any,
  callbacks?: { onError?: (willTerminate: any) => void }
): Process {
  log('will spawn runner')

  // allow user to hook into start event
  opts.callbacks?.onStart?.()

  const runnerModulePath = require.resolve('./runner')
  const childHookPath = compiler.getChildHookPath()

  log('using runner module at %s', runnerModulePath)
  log('using child-hook-path module at %s', childHookPath)

  const child = fork(runnerModulePath, ['-r', childHookPath], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PUMPKINS_EVAL: opts.eval.code,
      PUMPKINS_EVAL_FILENAME: opts.eval.fileName,
    },
  }) as Process

  const compileReqWatcher = filewatcher({ forcePolling: opts.poll })
  let currentCompilePath: string
  fs.writeFileSync(compiler.getCompileReqFilePath(), '')
  compileReqWatcher.add(compiler.getCompileReqFilePath())
  compileReqWatcher.on('change', function(file: string) {
    fs.readFile(file, 'utf-8', function(err, data) {
      if (err) {
        console.error('Error reading compile request file', err)
        return
      }
      const [compile, compiledPath] = data.split('\n')
      if (currentCompilePath === compiledPath) {
        return
      }
      currentCompilePath = compiledPath
      if (compiledPath) {
        compiler.compile({
          compile: compile,
          compiledPath: compiledPath,
          callbacks: opts.callbacks,
        })
      }
    })
  })

  child.on('exit', function(code, signal) {
    log('runner exiting')
    if (code === null) {
      log('runner did not exit on its own accord')
    } else {
      log('runner exited on its own accord with exit code %s', code)
    }

    if (signal === null) {
      log('runner did NOT receive a signal causing this exit')
    } else {
      log('runner received signal "%s" which caused this exit', signal)
    }

    // TODO is it possible for multiple exit event triggers?
    if (child.exited) return
    if (!child.respawn) {
      process.exit(code ?? 1)
    }
    child.exited = true
  })

  if (cfg.respawn) {
    child.respawn = true
  }

  if (compiler.tsConfigPath) {
    watcher.add(compiler.tsConfigPath)
  }

  ipc.on(child, 'compile', function(message: {
    compiledPath: string
    compile: string
  }) {
    if (!message.compiledPath || currentCompilePath === message.compiledPath) {
      return
    }
    currentCompilePath = message.compiledPath
    ;(message as any).callbacks = opts.callbacks
    compiler.compile(message)
  })

  // Listen for `required` messages and watch the required file.
  ipc.on(child, 'required', function(m) {
    const isIgnored =
      cfg.ignore.some(isPrefixOf(m.required)) ||
      cfg.ignore.some(isRegExpMatch(m.required))

    if (!isIgnored && (cfg.deps === -1 || getLevel(m.required) <= cfg.deps)) {
      watcher.add(m.required)
    }
  })

  // Upon errors, display a notification and tell the child to exit.
  ipc.on(child, 'error', function(m: any) {
    console.error(m.stack)
    callbacks?.onError?.(m.willTerminate)
  })

  compiler.writeReadyFile()

  return child
}
