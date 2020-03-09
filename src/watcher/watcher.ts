import anymatch from 'anymatch'
import { saveDataForChildProcess } from '../lib/layout'
import { clearConsole } from '../utils'
import { rootLogger } from '../utils/logger'
import { watch } from './chokidar'
import { compiler } from './compiler'
import * as Link from './link'
import { Opts } from './types'

const log = rootLogger.child('dev').child('watcher')

/**
 * Entrypoint into the watcher system.
 */
export function createWatcher(options: Opts): Promise<void> {
  return new Promise(async (resolve, reject) => {
    compiler.init(options)
    // compiler.stop = stopRunner

    // Setup the client (runner / server (watcher) system

    const link = new Link.Link({
      environmentAdditions: {
        NEXUS_EVAL: options.eval.code,
        NEXUS_EVAL_FILENAME: options.eval.fileName,
        ...saveDataForChildProcess(options.layout),
      },
      // Watch all modules imported by the user's app for changes.
      onRunnerImportedModule(data) {
        watcher.addSilently(data.filePath)
      },
    })

    process.onBeforeExit(() => {
      log.trace('tearndown before exit')
      return link.stop()
    })

    // Create a file watcher

    // TODO watch for changes to tsconfig and take correct action
    // TODO watch for changes to package json and take correct action (imagine
    // there could be nexus config in there)
    // TODO restart should take place following npm install/remove yarn
    // add/remove/install etc.
    // TODO need a way to test file matching given patterns. Hard to get right,
    // right now, and feedback loop sucks. For instance allow to find prisma
    // schema anywhere except in migrations ignore it, that is hard right now.

    const pluginWatchContributions = options.plugins.reduce(
      (patterns, p) =>
        patterns.concat(p.dev.addToWatcherSettings.watchFilePatterns ?? []),
      [] as string[]
    )

    const pluginIgnoreContributions = options.plugins.reduce(
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
      [options.layout.sourceRoot, ...pluginWatchContributions],
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
        return log.trace('global listener - DID NOT match file', { file })
      } else {
        log.trace('global listener - matched file', { file })
        restart(file)
      }
    })

    /**
     * Plugins watcher listeners
     */

    const devModePluginLens = {
      restart: restart,
    }

    for (const plugin of options.plugins) {
      if (plugin.dev.onFileWatcherEvent) {
        const isMatchedByPluginListener = createPathMatcher({
          toMatch:
            plugin.dev.addToWatcherSettings.listeners?.plugin
              ?.allowFilePatterns,
          toIgnore:
            plugin.dev.addToWatcherSettings.listeners?.plugin
              ?.ignoreFilePatterns,
        })

        watcher.on('all', (event, file, stats) => {
          if (isMatchedByPluginListener(file)) {
            log.trace('plugin listener - matched file', { file })
            plugin.dev.onFileWatcherEvent!(
              event,
              file,
              stats,
              devModePluginLens
            )
          } else {
            log.trace('plugin listener - DID NOT match file', { file })
          }
        })
      }
    }

    watcher.on('error', error => {
      log.error('file watcher encountered an error', { error })
    })

    watcher.on('ready', () => {
      log.trace('ready')
    })

    let restarting = false

    restarting = true
    clearConsole()
    await link.startOrRestart()
    restarting = false

    // todo replace crappy `restarting` flag with an async debounce that
    // includes awaiting completion of the returned promise. Basically this
    // library + feature request
    // https://github.com/sindresorhus/p-debounce/issues/3.
    async function restart(file: string) {
      if (restarting) {
        log.trace('restart already in progress')
        return
      }
      restarting = true
      clearConsole()
      log.info('restarting', { changed: file })
      if (file === compiler.tsConfigPath) {
        log.trace('reinitializing TS compilation')
        compiler.init(options)
      }
      compiler.compileChanged(file)
      await link.startOrRestart()
      restarting = false
    }
  })
}

/**
 * todo
 */
function createPathMatcher(params: {
  toMatch?: string[]
  toIgnore?: string[]
}): (files: string | string[]) => boolean {
  const toAllow = params?.toMatch ?? []
  const toIgnore = params?.toIgnore?.map(pattern => '!' + pattern) ?? []
  const matchers = [...toAllow, ...toIgnore]

  return anymatch(matchers)
}
