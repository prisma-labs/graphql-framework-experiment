import anymatch from 'anymatch'
import { saveDataForChildProcess } from '../framework/layout'
import { rootLogger } from '../utils/logger'
import cfgFactory from './cfg'
import * as CP from './child-process'
import { FileWatcher, watch } from './chokidar'
import { compiler } from './compiler'
import * as IPC from './ipc'
import { Opts } from './types'
import { isPrefixOf, isRegExpMatch } from './utils'

const logger = rootLogger
  .child('cli')
  .child('dev')
  .child('watcher')

/**
 * Entrypoint into the watcher system.
 */
export function createWatcher(opts: Opts): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const cfg = cfgFactory(opts)

    compiler.init(opts)
    compiler.stop = stopRunner

    // Run ./dedupe.js as preload script
    if (cfg.dedupe) process.env.NODE_DEV_PRELOAD = __dirname + '/dedupe'

    //
    // Setup State
    //

    // Create a file watcher

    // TODO watch for changes to tsconfig and take correct action
    // TODO watch for changes to package json and take correct action (imagine
    // there could be nexus config in there)
    // TODO restart should take place following npm install/remove yarn
    // add/remove/install etc.
    // TODO need a way to test file matching given patterns. Hard to get right,
    // right now, and feedback loop sucks. For instance allow to find prisma
    // schema anywhere except in migrations ignore it, that is hard right now.

    const pluginWatchContributions = opts.plugins.reduce(
      (patterns, p) =>
        patterns.concat(p.dev.addToWatcherSettings.watchFilePatterns ?? []),
      [] as string[]
    )

    const pluginIgnoreContributions = opts.plugins.reduce(
      (patterns, p) =>
        patterns.concat(
          p.dev.addToWatcherSettings.listeners?.app?.ignoreFilePatterns ?? []
        ),
      [] as string[]
    )
    const isIgnoredByCoreListener = createPathMatcher({
      toMatch: pluginIgnoreContributions,
    })

    const watcher = watch(
      [opts.layout.sourceRoot, ...pluginWatchContributions],
      {
        ignored: ['./node_modules', './.*'],
        ignoreInitial: true,
        cwd: process.cwd(), // prevent globbed files and required files from being watched twice
      }
    )

    /**
     * Core watcher listener
     */
    // TODO: plugin listeners can probably be merged into the core listener
    watcher.on('all', (_event, file) => {
      if (isIgnoredByCoreListener(file)) {
        return logger.trace('global listener - DID NOT match file', { file })
      } else {
        logger.trace('global listener - matched file', { file })
        restartRunner(file)
      }
    })

    const server = IPC.create()
    await server.start()
    server.on('error', reject)

    /**
     * Plugins watcher listeners
     */
    for (const p of opts.plugins) {
      if (p.dev.onFileWatcherEvent) {
        const isMatchedByPluginListener = createPathMatcher({
          toMatch:
            p.dev.addToWatcherSettings.listeners?.plugin?.allowFilePatterns,
          toIgnore:
            p.dev.addToWatcherSettings.listeners?.plugin?.ignoreFilePatterns,
        })

        watcher.on('all', (event, file, stats) => {
          if (isMatchedByPluginListener(file)) {
            logger.trace('plugin listener - matched file', { file })
            p.dev.onFileWatcherEvent!(event, file, stats, {
              restart: restartRunner,
            })
          } else {
            logger.trace('plugin listener - DID NOT match file', { file })
          }
        })
      }
    }

    watcher.on('error', error => {
      logger.error('file watcher encountered an error', { error })
    })

    watcher.on('ready', () => {
      logger.trace('ready')
    })

    // Create a mutable runner
    let runner = startRunnerDo()

    // Create some state to dedupe restarts. For example a rapid succession of
    // file changes will not trigger restart multiple times while the first
    // invocation was still running to completion.
    let runnerRestarting = false

    // Relay SIGTERM & SIGINT to the runner process tree
    //
    process.on('SIGTERM', () => {
      logger.trace('process got SIGTERM')
      server.stop()
      stopRunnerOnBeforeExit().then(() => {
        resolve()
      })
    })

    process.on('SIGINT', () => {
      logger.trace('process got SIGINT')
      server.stop()
      stopRunnerOnBeforeExit().then(() => {
        resolve()
      })
    })

    function startRunnerDo(): CP.Process {
      return startRunner(server, opts, cfg, watcher, {
        onError: willTerminate => {
          stopRunner(runner, willTerminate)
          watcher.resume()
        },
      })
    }

    function stopRunnerOnBeforeExit() {
      if (runner.exited) return Promise.resolve()

      // TODO maybe we should be a timeout here so that child process hanging
      // will never prevent nexus dev from exiting nicely.
      return runner
        .sigterm()
        .then(() => {
          logger.trace('sigterm to runner process tree completed')
        })
        .catch(error => {
          logger.warn(
            'attempt to sigterm the runner process tree ended with error',
            { error }
          )
        })
    }

    function stopRunner(child: CP.Process, willTerminate?: boolean) {
      if (child.exited || child.stopping) {
        return
      }
      child.stopping = true

      if (willTerminate) {
        logger.trace(
          'Disconnecting from child. willTerminate === true so NOT sending sigterm to force runner end, assuming it will end itself.'
        )
      } else {
        logger.trace(
          'Disconnecting from child. willTerminate === false so sending sigterm to force runner end'
        )
        child
          .sigterm()
          .then(() => {
            logger.trace('sigterm to runner process tree completed')
          })
          .catch(error => {
            logger.warn(
              'attempt to sigterm the runner process tree ended with error',
              { error }
            )
          })
      }
    }

    function restartRunner(file: string) {
      /**
       * Watcher is paused until the runner has stopped and properly restarted
       * We wait for the child process to send the watcher a message saying it's ready to be restarted
       * This prevents the runner to be run several times thus leading to an EPIPE error
       */
      watcher.pause()
      if (file === compiler.tsConfigPath) {
        logger.trace('reinitializing TS compilation')
        compiler.init(opts)
      }

      compiler.compileChanged(file, opts.onEvent)

      if (runnerRestarting) {
        logger.trace('already starting')
        return
      }

      runnerRestarting = true
      if (!runner.exited) {
        logger.trace('runner is still executing, will restart upon its exit')
        runner.on('exit', () => {
          runner = startRunnerDo()
          runnerRestarting = false
        })
        stopRunner(runner)
      } else {
        logger.trace('runner already exited, probably due to a previous error')
        runner = startRunnerDo()
        runnerRestarting = false
      }
    }
  })
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

/**
 * Start the App Runner. This occurs once on boot and then on every subsequent
 * file change in the users's project.
 */
function startRunner(
  server: IPC.Server,
  opts: Opts,
  cfg: ReturnType<typeof cfgFactory>,
  watcher: FileWatcher,
  callbacks?: { onError?: (willTerminate: any) => void }
): CP.Process {
  logger.trace('will spawn runner')

  const runnerModulePath = require.resolve('./runner')
  // const childHookPath = compiler.getChildHookPath()

  // logger.trace('start runner', { runnerModulePath, childHookPath })

  // TODO: childHook is no longer used at all
  // const child = fork('-r' [runnerModulePath, childHookPath], {
  //
  // We are leaving this as a future fix, refer to:
  // https://github.com/graphql-nexus/nexus-future/issues/76
  const child = CP.create({
    modulePath: runnerModulePath,
    nodeArgs: opts.nodeArgs ?? [],
    envAdditions: {
      NEXUS_EVAL: opts.eval.code,
      NEXUS_EVAL_FILENAME: opts.eval.fileName,
      ...saveDataForChildProcess(opts.layout),
    },
  })

  child.onData(chunk => {
    opts.onEvent({ event: 'logging', data: chunk.toString() })
  })

  // TODO We have removed this code since switching to chokidar. What is the
  // tradeoff exactly that we are making by no longer using this logic?
  //
  // const compileReqWatcher = filewatcher({ forcePolling: opts.poll })
  // let currentCompilePath: string
  // fs.writeFileSync(compiler.getCompileReqFilePath(), '')
  // compileReqWatcher.add(compiler.getCompileReqFilePath())
  // compileReqWatcher.on('change', function(file: string) {
  //   log('compileReqWatcher event change %s', file)
  //   fs.readFile(file, 'utf-8', function(err, data) {
  //     if (err) {
  //       console.error('error reading compile request file', err)
  //       return
  //     }
  //     const [compile, compiledPath] = data.split('\n')
  //     if (currentCompilePath === compiledPath) {
  //       return
  //     }
  //     currentCompilePath = compiledPath
  //     if (compiledPath) {
  //       compiler.compile({
  //         compile,
  //         compiledPath,
  //         callbacks: opts.callbacks ?? {},
  //       })
  //     }
  //   })
  // })

  child.onExit(({ exitCode, signal }) => {
    logger.trace('runner exiting')
    if (exitCode === null) {
      logger.trace('runner did not exit on its own accord')
    } else {
      logger.trace('runner exited on its own accord with exit code', {
        code: exitCode,
      })
    }

    if (signal === null) {
      logger.trace('runner did NOT receive a signal causing this exit')
    } else {
      logger.trace('runner received signal which caused this exit', { signal })
    }

    // TODO is it possible for multiple exit event triggers?
    if (child.exited) return
    child.exited = true
  })

  if (compiler.tsConfigPath) {
    watcher.addSilently(compiler.tsConfigPath)
  }

  // TODO See above LOC ~238
  // ipc.on(
  //   child,
  //   'compile',
  //   (message: { compiledPath: string; compile: string }) => {
  //     log('got runner message "compile" %s', message)
  //     if (
  //       !message.compiledPath ||
  //       currentCompilePath === message.compiledPath
  //     ) {
  //       return
  //     }
  //     currentCompilePath = message.compiledPath
  //     ;(message as any).callbacks = opts.callbacks
  //     compiler.compile({ ...message, callbacks: opts.callbacks ?? {} })
  //   }
  // )

  server.on('message', function(msg) {
    if (msg.type === 'runner:module_required') {
      // Listen for `required` messages and watch the required file.
      const isIgnored =
        cfg.ignore.some(isPrefixOf(msg.data.filePath)) ||
        cfg.ignore.some(isRegExpMatch(msg.data.filePath))

      if (
        !isIgnored &&
        (cfg.deps === -1 || getLevel(msg.data.filePath) <= cfg.deps)
      ) {
        watcher.addSilently(msg.data.filePath)
      }
    } else if (msg.type === 'runner:error') {
      // Upon errors, display a notification and tell the child to exit.
      callbacks?.onError?.(msg.data.willTerminate)
    } else if (msg.type === 'runner:app_server_listening') {
      // todo: Resuming watcher on this signal can lead to performance issues
      /**
       * Watcher is resumed once the child sent a message saying it's ready to be restarted
       * This prevents the runner to be run several times thus leading to an EPIPE error
       */
      watcher.resume()
    }
  })

  compiler.writeReadyFile()

  return child
}

function createPathMatcher(params: {
  toMatch?: string[]
  toIgnore?: string[]
}): (files: string | string[]) => boolean {
  const toAllow = params?.toMatch ?? []
  const toIgnore = params?.toIgnore?.map(pattern => '!' + pattern) ?? []
  const matchers = [...toAllow, ...toIgnore]

  return anymatch(matchers)
}
