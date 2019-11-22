import { fork } from 'child_process'
import * as fs from 'fs'
import { compiler } from './compiler'
import * as ipc from './ipc'
import resolveMain from './resolveMain'
import { Callbacks, Opts, Process } from './types'
import cfgFactory from './cfg'
import { pog } from '../utils'
const filewatcher = require('filewatcher')
const kill = require('tree-kill')

const log = pog.sub('watcher')

export function watcher(
  script: string | undefined,
  scriptArgs: string[],
  nodeArgs: string[],
  opts: Opts,
  callbacks: Callbacks
) {
  // The child_process
  let child: Process | undefined = undefined
  const wrapper = resolveMain(__dirname + '/wrap')
  const cfg = cfgFactory(opts)
  compiler.init(opts)

  compiler.stop = stop
  // Run ./dedupe.js as preload script
  if (cfg.dedupe) process.env.NODE_DEV_PRELOAD = __dirname + '/dedupe'

  const watcher = filewatcher({
    forcePolling: opts.poll,
    interval: parseInt(opts.interval!, 10),
    debounce: parseInt(opts.debounce!, 10),
    recursive: true,
  })
  let starting = false
  watcher.on('change', restart)

  watcher.on('fallback', function(limit: number) {
    console.warn(
      'node-dev ran out of file handles after watching %s files.',
      limit
    )
    console.warn('Falling back to polling which uses more CPU.')
    console.info('Run ulimit -n 10000 to increase the file descriptor limit.')
    if (cfg.deps)
      console.info('... or add `--no-deps` to use less file handles.')
  })

  /**
   * Run the wrapped script.
   */
  function start() {
    if (callbacks && callbacks.onStart) {
      callbacks.onStart()
    }
    for (let watched of (opts.watch || '').split(',')) {
      if (watched) watcher.add(watched)
    }
    let cmd = nodeArgs.concat(wrapper, script ?? '', scriptArgs)
    const childHookPath = compiler.getChildHookPath()
    cmd = ['-r', childHookPath].concat(cmd)
    log('Starting child process %s', cmd.join(' '))
    child = fork(cmd[0], cmd.slice(1), {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PUMPKINS_EVAL: opts.eval?.code ?? undefined,
        PUMPKINS_EVAL_FILENAME: opts.eval?.fileName ?? undefined,
      },
    })
    starting = false
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
            callbacks: callbacks,
          })
        }
      })
    })

    child.on('exit', function(code) {
      log('Child exited with code %s', code)
      if (!child) return
      if (!child.respawn) {
        process.exit(code ?? 1)
      }
      child = undefined
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
      if (
        !message.compiledPath ||
        currentCompilePath === message.compiledPath
      ) {
        return
      }
      currentCompilePath = message.compiledPath
      ;(message as any).callbacks = callbacks
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
    ipc.on(child, 'error', function(m) {
      console.error(m.stack)
      stop(m.willTerminate)
    })
    compiler.writeReadyFile()
  }

  const killChild = () => {
    if (!child) return
    log('Sending SIGTERM kill to child pid', child.pid)
    if (opts['tree-kill']) {
      log('Using tree-kill')
      kill(child.pid)
    } else {
      child.kill('SIGTERM')
    }
  }

  function stop(willTerminate?: boolean) {
    if (!child || child.stopping) {
      return
    }
    child.stopping = true
    child.respawn = true
    if (child.connected === undefined || child.connected === true) {
      log('Disconnecting from child')
      child.disconnect()
      if (!willTerminate) {
        killChild()
      }
    }
  }

  function restart(file: string, isManualRestart: boolean) {
    if (file === compiler.tsConfigPath) {
      log('Reinitializing TS compilation')
      compiler.init(opts)
    }
    /* eslint-disable no-octal-escape */
    if (cfg.clear) process.stdout.write('\\033[2J\\033[H')
    if (isManualRestart === true) {
      log('Restarting', 'manual restart from user')
    } else {
      log('Restarting', file + ' has been modified')
    }
    compiler.compileChanged(file, callbacks)
    if (starting) {
      log('Already starting')
      return
    }
    log('Removing all watchers from files')
    watcher.removeAll()
    starting = true
    if (child) {
      log('Child is still running, restart upon exit')
      child.on('exit', start)
      stop()
    } else {
      log('Child is already stopped, probably due to a previous error')
      start()
    }
  }

  // Relay SIGTERM
  process.on('SIGTERM', function() {
    log('Process got SIGTERM')
    killChild()
    process.exit(0)
  })

  start()
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
