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
const SILENT_EVENTS = ['add', 'addDir'] as const

function isSilentEvent(event: any): event is typeof SILENT_EVENTS[number] {
  return SILENT_EVENTS.includes(event)
}

export function watch(
  paths: string | ReadonlyArray<string>,
  options?: FileWatcherOptions
): FileWatcher {
  log('starting', { paths, ...options })
  const watcher = chokidar.watch(paths, options) as FileWatcher
  const programmaticallyWatchedFiles: string[] = []

  const isFileIgnored = (event: string, file: string) => {
    if (programmaticallyWatchedFiles.includes(file) && isSilentEvent(event)) {
      log('ignoring file addition because was added silently %s', file)
      return true
    }

    log('file watcher event "%s" originating from file/dir %s', event, file)
    return false
  }

  // @ts-ignore
  const originalOnListener = watcher.on

  watcher.addSilently = path => {
    programmaticallyWatchedFiles.push(path)
    watcher.add(path)
  }

  // Use `function` to bind originalOnListener to the right context
  watcher.on = function(event: string, listener: (...args: any[]) => void) {
    if (event === 'all') {
      return originalOnListener.call(this, event, (eventName, path, stats) => {
        if (isFileIgnored(eventName, path) === false) {
          listener(eventName, path, stats)
        }
      })
    }

    if (isSilentEvent(event)) {
      return originalOnListener.call(this, event, (path, stats) => {
        if (isFileIgnored(event, path) === false) {
          listener(path, stats)
        }
      })
    }

    return originalOnListener.call(this, event, listener)
  }

  return watcher
}
