import * as path from 'path'
import { Opts } from './types'

function resolvePath(unresolvedPath: string) {
  return path.resolve(process.cwd(), unresolvedPath)
}

export default function(opts?: Omit<Opts, 'eval'>) {
  const c: any = {}

  // Truthy == --all-deps, false: one level of deps
  if (typeof c.deps !== 'number') c.deps = c.deps ? -1 : 1

  if (opts) {
    // Overwrite with CLI opts ...
    if (opts.allDeps) c.deps = -1
    if (!opts.deps) c.deps = 0
    if (opts.dedupe) c.dedupe = true
    if (opts.respawn) c.respawn = true
  }

  const ignoreWatch = [
    ...(opts && opts['ignore-watch'] ? opts['ignore-watch'] : []),
  ]
  const ignore = ignoreWatch.concat(ignoreWatch.map(resolvePath))

  return {
    vm: c.vm !== false,
    fork: c.fork !== false,
    deps: c.deps,
    timestamp: c.timestamp || (c.timestamp !== false && 'HH:MM:ss'),
    clear: !!c.clear,
    dedupe: !!c.dedupe,
    ignore: ignore,
    respawn: c.respawn || false,
    debug: opts?.debug,
  }
}
