import treeKill = require('tree-kill')
import { pog } from '../utils'
import { Process } from './types'

const log = pog.sub('watcher')

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
    log(
      'logic asked to SIGTERM child %s but it has already exited, doing nothing',
      child.pid
    )
    return Promise.resolve()
  }

  log(
    'sending SIGTERM to child %s and any of its descendent processes',
    child.pid
  )

  return treeKillAsync(child.pid)
}
