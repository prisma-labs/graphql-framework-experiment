import * as PTY from 'node-pty'
import { rootLogger } from '../utils/logger'
import treeKill = require('tree-kill')

const logger = rootLogger.child('watcher:process')

export interface Process extends PTY.IPty {
  stopping?: boolean
  exited: undefined | true
  sigterm(): ReturnType<typeof sendSigterm>
}

type Options = {
  envAdditions: Record<string, string>
  modulePath: string
  nodeArgs: string[]
}

export function create(opts: Options): Process {
  const child = PTY.spawn('node', [opts.modulePath, ...opts.nodeArgs], {
    cwd: process.cwd(),
    cols: process.stdout.columns,
    rows: process.stdout.rows,
    env: {
      ...(process.env as any),
      ...opts.envAdditions,
    },
  }) as Process

  process.stdout.on('resize', () => {
    const { columns, rows } = process.stdout
    child.resize(columns, rows)
  })

  // todo use native .kill instead?
  child.sigterm = sendSigterm.bind(null, child)

  return child
}

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
