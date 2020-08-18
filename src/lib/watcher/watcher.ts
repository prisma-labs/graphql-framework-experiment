import anymatch from 'anymatch'
import { rootLogger } from '../nexus-logger'
import { WorktimeHooks } from '../plugin'
import { clearConsole } from '../process'
import * as Chok from './chokidar'
import * as Link from './link'
import { Options } from './types'

const log = rootLogger.child('dev').child('watcher')

export type ChangeEvent = PostInitChangeEvent | InitChangeEvent

export type InitChangeEvent = {
  type: 'init'
  file: null
}

export type PostInitChangeEvent =
  | {
      type: Chok.ChangeEvent['type']
      file: Chok.ChangeEvent['file']
    }
  | {
      type: 'plugin'
      file: Chok.ChangeEvent['file']
    }

export interface RunnerOptions {
  environmentAdditions?: Record<string, string>
  entrypointScript?: string
}

export interface Watcher {
  start: () => Promise<void>
  stop: () => Promise<void>
}

/**
 * Entrypoint into the watcher system.
 */
export async function createWatcher(options: Options): Promise<Watcher> {
  // Setup the client (runner / server (watcher) system
  const link = new Link.Link({
    entrypointScript: options.entrypointScript,
    // Watch all modules imported by the user's app for changes.
    onRunnerImportedModule(data) {
      watcher.addSilently(data.filePath)
    },
    async onServerListening() {
      for (const p of options.plugins) {
        await p.dev.onAfterWatcherRestart?.()
      }

      options.events?.({ type: 'server_listening' })
    },
    onRunnerStdioMessage({ stdio, data }) {
      options.events?.({ type: 'runner_stdio', stdio, data })
    },
    inspectBrk: options.inspectBrk,
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
    (patterns, p) => patterns.concat(p.dev.addToWatcherSettings.watchFilePatterns ?? []),
    [] as string[]
  )

  const pluginIgnoreContributions = options.plugins.reduce(
    (patterns, p) => patterns.concat(p.dev.addToWatcherSettings.listeners?.app?.ignoreFilePatterns ?? []),
    [] as string[]
  )
  const isIgnoredByCoreListener = createPathMatcher({
    toMatch: pluginIgnoreContributions,
  })

  const watcher = Chok.watch([options.sourceRoot, ...pluginWatchContributions], {
    ignored: ['./node_modules', /(^|[\/\\])\../],
    ignoreInitial: true,
    cwd: options.cwd, // prevent globbed files and required files from being watched twice,
  })

  /**
   * Core watcher listener
   */

  // TODO: plugin listeners can pjobably be merged into the core listener
  watcher.on('all', (changeType, changedFile) => {
    const event = { type: changeType, file: changedFile }
    if (isIgnoredByCoreListener(changedFile)) {
      return log.trace('global listener - DID NOT match file', {
        event,
      })
    } else {
      log.trace('global listener - matched file', { event })
      restart(event, options.plugins)
    }
  })

  /**
   * Plugins watcher listeners
   */

  const devModePluginLens = {
    restart: (file: string) => {
      return restart({ type: 'plugin', file: file }, options.plugins)
    },
    pause: () => {
      return watcher.pause()
    },
    resume: () => {
      return watcher.resume()
    },
  }

  for (const plugin of options.plugins) {
    if (plugin.dev.onFileWatcherEvent) {
      const isMatchedByPluginListener = createPathMatcher({
        toMatch: plugin.dev.addToWatcherSettings.listeners?.plugin?.allowFilePatterns,
        toIgnore: plugin.dev.addToWatcherSettings.listeners?.plugin?.ignoreFilePatterns,
      })

      watcher.on('all', (event, file, stats) => {
        if (isMatchedByPluginListener(file)) {
          log.trace('plugin listener - matched file', { file })
          plugin.dev.onFileWatcherEvent!(event, file, stats, devModePluginLens)
        } else {
          log.trace('plugin listener - DID NOT match file', { file })
        }
      })
    }
  }

  watcher.on('error', (error) => {
    log.error('file watcher encountered an error', { error })
  })

  watcher.on('ready', () => {
    log.trace('ready')
  })

  let restarting = false

  restarting = true
  clearConsole()
  for (const plugin of options.plugins) {
    const runnerChanges = await plugin.dev.onBeforeWatcherStartOrRestart?.({
      type: 'init',
      file: null,
    })
    if (runnerChanges) {
      link.updateOptions(runnerChanges)
    }
  }
  await link.startOrRestart()
  restarting = false

  // todo replace crappy `restarting` flag with an async debounce that
  // includes awaiting completion of the returned promise. Basically this
  // library + feature request
  // https://github.com/sindresorhus/p-debounce/issues/3.
  async function restart(change: PostInitChangeEvent, plugins: WorktimeHooks[]) {
    if (restarting) {
      log.trace('restart already in progress')
      return
    }
    restarting = true
    clearConsole()
    log.info('restarting', change)

    log.trace('hook', { name: 'beforeWatcherStartOrRestart' })
    for (const plugin of plugins) {
      const runnerChanges = await plugin.dev.onBeforeWatcherStartOrRestart?.(change)
      if (runnerChanges) {
        link.updateOptions(runnerChanges)
      }
    }

    log.trace('hook', { name: 'beforeWatcherRestart' })
    plugins.forEach((p) => {
      p.dev.onBeforeWatcherRestart?.()
    })

    options.events?.({ type: 'restart', file: change.file, reason: change.type })
    await link.startOrRestart()
    restarting = false
    watcher.resume()
  }

  let resolveWatcherPromise: null | (() => void) = null

  const watcherPromise = new Promise<void>((resolve) => {
    resolveWatcherPromise = resolve
  })

  return {
    stop: async () => {
      await watcher.close()
      await link.stop()
      resolveWatcherPromise?.()
    },
    start: () => {
      return watcherPromise
    },
  }
}

/**
 * todo
 */
function createPathMatcher(params: {
  toMatch?: string[]
  toIgnore?: string[]
}): (files: string | string[]) => boolean {
  const toAllow = params?.toMatch ?? []
  const toIgnore = params?.toIgnore?.map((pattern) => '!' + pattern) ?? []
  const matchers = [...toAllow, ...toIgnore]

  return anymatch(matchers)
}
