import { rootLogger } from '../nexus-logger'

const log = rootLogger.child('worker')

/**
 * Run the extractor in a work if possible. For example in Node 10 workers are
 * not available by default. If workers are not available then extraction falls
 * back to running in this process, possibly blocking with with intensive CPU work.
 */
export function runInWorkerIfPossible(params: {
  availableFn: () => any
  fallbackFn: () => any
}) {
  let hasWorkerThreads = areWorkerThreadsAvailable()

  if (hasWorkerThreads) {
    log.trace('Worker threads available')
    params.availableFn()
  } else {
    log.trace('Worker threads unavailable. Fallbacking to main process')
    params.fallbackFn()
  }
}

/**
 * Check whether Worker Threads are available. In Node 10, workers aren't available by default.
 */
function areWorkerThreadsAvailable(): boolean {
  try {
    require('worker_threads')
    return true
  } catch {
    return false
  }
}
