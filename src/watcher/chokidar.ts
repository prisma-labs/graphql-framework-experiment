import * as chokidar from 'chokidar'
import * as fs from 'fs'

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

export function watch(
  paths: string | ReadonlyArray<string>,
  options?: FileWatcherOptions
): FileWatcher {
  const watcher = chokidar.watch(paths, options) as FileWatcher
  const programmaticallyWatchedFiles: string[] = []

  watcher.addSilently = path => {
    programmaticallyWatchedFiles.push(path)
    watcher.add(path)
  }

  if (options && options.onAll) {
    watcher.on('all', (event, file, stats) => {
      if (programmaticallyWatchedFiles.includes(file) && event === 'add') {
        return
      }

      options.onAll!(event, file, stats)
    })
  }

  return watcher
}
