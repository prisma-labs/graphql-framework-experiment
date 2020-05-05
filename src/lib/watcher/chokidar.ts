/**
 * This module exists because chokidar does not support silently adding modules
 * to the watch list. We've started a discussion about adding this feature into
 * core here: https://github.com/paulmillr/chokidar/issues/953
 */
import * as chokidar from 'chokidar'
import * as fs from 'fs'
import { rootLogger } from '../nexus-logger'

const log = rootLogger.child('dev').child('watcher')

export type ChangeType = 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir'

export interface ChangeEvent {
  type: ChangeType
  file: string
}

export type FileWatcher = chokidar.FSWatcher & {
  /**
   * Adds a file to be watched without triggering the 'add' events
   */
  addSilently(path: string): void
  pause(): void
  resume(): void
}

export type FileWatcherEventCallback = (
  eventName: ChangeType,
  path: string,
  stats: fs.Stats | undefined,
  watcher: {
    restart: (file: string) => void
    pause: () => void
    resume: () => void
  }
) => void

type FileWatcherOptions = chokidar.WatchOptions
const SILENTABLE_EVENTS = ['add', 'addDir'] as const

function isSilentableEvent(event: any): event is typeof SILENTABLE_EVENTS[number] {
  return SILENTABLE_EVENTS.includes(event)
}

export function watch(paths: string | ReadonlyArray<string>, options?: FileWatcherOptions): FileWatcher {
  log.trace('starting', { paths, ...options })
  const watcher = chokidar.watch(paths, options) as FileWatcher
  const programmaticallyWatchedFiles: string[] = []
  let watcherPaused = false

  const wasFileAddedSilently = (event: string, file: string): boolean => {
    if (programmaticallyWatchedFiles.includes(file) && isSilentableEvent(event)) {
      log.trace('ignoring file addition because was added silently', {
        file,
      })
      return true
    }

    log.trace('file watcher event', { event, origin: file })
    return false
  }

  const originalOnListener = watcher.on.bind(watcher)

  // Use `function` to bind originalOnListener to the right context
  watcher.on = function (event: string, listener: (...args: any[]) => void) {
    if (event === 'all') {
      return originalOnListener(event, (eventName, path, stats) => {
        if (watcherPaused) {
          return
        }

        if (wasFileAddedSilently(eventName, path) === true) {
          return
        }

        listener(eventName, path, stats)
      })
    }

    return originalOnListener(event, (path, stats) => {
      if (watcherPaused) {
        return
      }

      if (wasFileAddedSilently(event, path) === true) {
        return
      }

      listener(path, stats)
    })
  }

  watcher.addSilently = (path) => {
    programmaticallyWatchedFiles.push(path)
    watcher.add(path)
  }

  watcher.pause = () => {
    watcherPaused = true
  }

  watcher.resume = () => {
    watcherPaused = false
  }

  return watcher
}
