import treeKill = require('tree-kill')
import { rootLogger } from '../utils/logger'
import { Process } from './types'

const logger = rootLogger.child('watcher')

/**
 * Promisification of the tree-kill package.
 */
function treeKillAsync(pid: number, signal: string = 'SIGTERM'): Promise<void> {
  return new Promise((resolve, reject) => {
    treeKill(pid, signal, error => {
      if (error) reject(Error)
      else resolve()
    })
  })
}

/**
 * Send SIGTERM to non-exited child using a tree-kill strategy.
 */
export function sendSigterm(child: Process): Promise<void> {
  if (child.exited) {
    logger.trace(
      'logic asked to SIGTERM child but it has already exited, doing nothing',
      { childPID: child.pid }
    )
    return Promise.resolve()
  }

  logger.trace('sending SIGTERM to child and any of its descendent processes', {
    childPID: child.pid,
  })

  return treeKillAsync(child.pid)
}
