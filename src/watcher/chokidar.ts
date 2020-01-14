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
  restart: any,
  stats?: fs.Stats
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

  watcher.addSilently = path => {
    programmaticallyWatchedFiles.push(path)
    watcher.add(path)
  }

  const originalOnListener = watcher.on

  const raiseIfNotIgnored = (
    event: string,
    file: string,
    cb: (...args: any[]) => any
  ) => {
    if (programmaticallyWatchedFiles.includes(file) && isSilentEvent(event)) {
      log('ignoring file addition because was added silently %s', file)
      return
    } else {
      log('file watcher event "%s" originating from file/dir %s', event, file)
      cb()
    }
  }

  watcher.on = (event: string, listener: (...args: any[]) => void) => {
    if (event === 'all') {
      originalOnListener(event, (eventName, path, stats) => {
        raiseIfNotIgnored(eventName, path, () => {
          listener(eventName, path, stats)
        })
      })
    } else if (isSilentEvent(event)) {
      originalOnListener(event, (path, stats) => {
        raiseIfNotIgnored(event, path, () => {
          listener(path, stats)
        })
      })
    } else {
      originalOnListener(event, listener)
    }

    return watcher
  }

  return watcher
}
