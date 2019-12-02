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

type FileWatcherOptions = chokidar.WatchOptions & {
  onAll?: (
    eventName: 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir',
    path: string,
    stats?: fs.Stats
  ) => void
}

const SILENT_EVENTS = ['add', 'addDir']

export function watch(
  paths: string | ReadonlyArray<string>,
  options?: FileWatcherOptions
): FileWatcher {
  log('starting', { paths, ...options })
  const watcher = chokidar.watch(paths, options) as FileWatcher
  const programmaticallyWatchedFiles: string[] = []
  let watcherReady = false

  watcher.addSilently = path => {
    programmaticallyWatchedFiles.push(path)
    watcher.add(path)
  }

  if (options && options.onAll) {
    watcher.on('all', (event, file, stats) => {
      if (
        (!watcherReady || programmaticallyWatchedFiles.includes(file)) &&
        SILENT_EVENTS.includes(event)
      ) {
        log('ignoring file addition because was added silently %s', file)
        return
      } else {
        log('file watcher event "%s" originating from file/dir %s', event, file)
      }

      options.onAll!(event, file, stats)
    })
    watcher.on('ready', () => {
      watcherReady = true
    })
  }

  return watcher
}
