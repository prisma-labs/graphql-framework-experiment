import * as nodecp from 'child_process'
import * as lo from 'lodash'
import { rootLogger } from '../utils/logger'

const log = rootLogger.child('dev').child('link')

interface Options {
  environmentAdditions?: Record<string, string>
}

export class Link {
  constructor(private options: Options) {
    process.on('SIGTERM', () => {
      log.trace('forwarding SIGTERM')
      this.stop()
    })
    process.on('SIGINT', () => {
      // Note SIGINT becomes SIGTERM to the runner
      log.trace('forwarding SIGINT as SIGTERM')
      this.stop()
    })
  }

  async startOrRestart() {
    log.trace('startOrRestart requested')
    if (this.startOrRestartPending) {
      log.trace('already a startOrRestartPending in progress')
      return
    }

    this.stopped = false
    this.stopping = null
    this.startOrRestartPending = true
    if (this.childProcess) {
      await this.kill()
    }
    this.startOrRestartPending = false
    // may have been stopped while killing previous
    if (!this.stopped) {
      this.spawnRunner()
    }
  }

  // onMessage(cb: (data: object) => void) {
  //   this.listeners.push(cb)
  //   this.childProcess?.on('message', cb)
  // }

  stop() {
    log.trace('stop requested')
    if (this.stopped) {
      log.trace('already stopped')
      if (this.stopping === null) {
        throw new Error('invariant violation, stopped but no stopping promise')
      }
      return this.stopping
    }
    this.stopped = true
    this.stopping = this.kill()
    return this.stopping
  }

  private kill() {
    log.trace('kill child')
    return new Promise<StopResult>(res => {
      if (!this.childProcess) {
        log.trace('child already killed')
        return res(null)
      }
      this.childProcess.kill('SIGKILL')
      this.childProcess.once('exit', (code, signal) => {
        log.trace('killed child', { code, signal })
        this.childProcess = null
        res({ code, signal })
      })
    })
  }

  private stopped = true

  private stopping: null | Promise<StopResult> = null

  private startOrRestartPending = false

  private childProcess: null | nodecp.ChildProcessWithoutNullStreams = null

  // private listeners: any[] = []

  private spawnRunner() {
    log.trace('spawn child')

    if (this.childProcess) {
      throw new Error(
        'attempt to spawn while previous child process still exists'
      )
    }
    this.childProcess = nodecp.fork(require.resolve('./runner'), [], {
      cwd: process.cwd(),
      stdio: 'pipe',
      env: lo.merge({}, process.env, this.options.environmentAdditions),
    }) as nodecp.ChildProcessWithoutNullStreams

    this.childProcess.stdout.on('data', data => {
      process.stdout.write(data)
    })
    // todo
    // this.childProcess.once('error', )

    // for (const listener of this.listeners) {
    //   this.childProcess.on('message', listener)
    // }
  }
}
type StopResult = null | {
  code: null | number
  signal: null | NodeJS.Signals
}
