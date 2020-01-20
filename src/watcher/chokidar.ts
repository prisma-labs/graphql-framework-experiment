/**
 * This module exists because chokidar does not support silently adding modules
 * to the watch list. We've started a discussion about adding this feature into
 * core here: https://github.com/paulmillr/chokidar/issues/953
 */
import * as chokidar from 'chokidar'
import * as fs from 'fs'
import { pog } from '../utils'

const log = pog.sub('file-watcher')

export type FileWatcher = chokidar.FSWatcher & {
  /**
   * Adds a file to be watched without triggering the 'add' events
   */
  addSilently(path: string): void
  pause(): void
  resume(): void
}

export type FileWatcherEventCallback = (
  eventName: 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir',
  path: string,
  stats: fs.Stats | undefined,
  runner: {
    restart: (file: string) => void /* stop: () => void, start: () => void */
  } //TODO: add stop and start methods
) => void

type FileWatcherOptions = chokidar.WatchOptions
const SILENTABLE_EVENTS = ['add', 'addDir'] as const

function isSilentableEvent(
  event: any
): event is typeof SILENTABLE_EVENTS[number] {
  return SILENTABLE_EVENTS.includes(event)
}

export function watch(
  paths: string | ReadonlyArray<string>,
  options?: FileWatcherOptions
): FileWatcher {
  log('starting', { paths, ...options })
  const watcher = chokidar.watch(paths, options) as FileWatcher
  const programmaticallyWatchedFiles: string[] = []
  let watcherPaused = false
  let lastPendingExecution: null | (() => void) = null

  const wasFileAddedSilently = (event: string, file: string): boolean => {
    if (
      programmaticallyWatchedFiles.includes(file) &&
      isSilentableEvent(event)
    ) {
      log('ignoring file addition because was added silently %s', file)
      return true
    }

    log('file watcher event "%s" originating from file/dir %s', event, file)
    return false
  }

  /** Execute watcher listener when watcher is not paused, and save last pending execution to be run when watcher.resume() is called */
  const simpleDebounce = (
    fn: (...args: any[]) => void
  ): ((...args: any[]) => void) => {
    const decoratedFn = (...args: any[]) => {
      if (watcherPaused) {
        lastPendingExecution = () => {
          fn(...args)
        }
        return
      }

      fn(...args)
    }

    return decoratedFn
  }

  const originalOnListener = watcher.on.bind(watcher)

  // Use `function` to bind originalOnListener to the right context
  watcher.on = function(event: string, listener: (...args: any[]) => void) {
    const debouncedListener = simpleDebounce(listener)

    if (event === 'all') {
      return originalOnListener(event, (eventName, path, stats) => {
        if (wasFileAddedSilently(eventName, path) === false) {
          debouncedListener(eventName, path, stats)
        }
      })
    }

    return originalOnListener(event, (path, stats) => {
      if (wasFileAddedSilently(event, path) === false) {
        debouncedListener(path, stats)
      }
    })
  }

  watcher.addSilently = path => {
    programmaticallyWatchedFiles.push(path)
    watcher.add(path)
  }

  watcher.pause = () => {
    watcherPaused = true
  }

  watcher.resume = () => {
    watcherPaused = false

    if (lastPendingExecution) {
      lastPendingExecution()
      lastPendingExecution = null
    }
  }

  return watcher
}
