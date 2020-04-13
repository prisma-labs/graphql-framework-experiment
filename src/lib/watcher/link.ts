import * as nodecp from 'child_process'
import { rootLogger } from '../nexus-logger'
import * as TTYLinker from '../tty-linker'
import { Message, ModuleRequiredMessage } from './ipc'

const log = rootLogger.child('dev').child('link')

interface ChangeableOptions {
  environmentAdditions?: Record<string, string>
}

interface Options extends ChangeableOptions {
  onRunnerImportedModule?: (data: ModuleRequiredMessage['data']) => void
  onServerListening?: () => void
  /**
   * Port on which the debugger should listen to 
   */
  inspectBrk?: number
}

export class Link {
  constructor(private options: Options) {}

  updateOptions(options: ChangeableOptions) {
    this.options = {
      ...this.options,
      ...options,
    }
  }

  async startOrRestart() {
    log.trace('startOrRestart requested')

    if (this.startingOrRestarting) {
      log.trace('already a startOrRestartPending in progress')
      return
    }

    this.stopped = false
    this.stopping = null
    this.startingOrRestarting = true
    if (this.childProcess) {
      await this.kill()
    }
    this.startingOrRestarting = false
    // may have been stopped while killing previous
    if (!this.stopped) {
      this.spawnRunner()
    }
  }

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

    return new Promise<StopResult>((res) => {
      if (!this.childProcess) {
        log.trace('child already killed')
        return res(null)
      }
      this.childProcess.kill('SIGKILL')
      this.childProcess.once('exit', (code, signal) => {
        log.trace('killed child', { code, signal })
        this.ttyLinker.parent.unforward(this.childProcess!)
        this.childProcess = null
        res({ code, signal })
      })
    })
  }

  private ttyLinker = TTYLinker.create()

  private stopped: boolean = true

  private stopping: null | Promise<StopResult> = null

  private startingOrRestarting: boolean = false

  private childProcess: null | nodecp.ChildProcessWithoutNullStreams = null

  private spawnRunner() {
    log.trace('spawn child')

    if (this.childProcess) {
      throw new Error('attempt to spawn while previous child process still exists')
    }

    const forkCmd: string[] = []

    if (this.options.inspectBrk) {
      forkCmd.push(`--inspect-brk=${this.options.inspectBrk.toString()}`)
    }

    forkCmd.push(require.resolve('./runner'))

    const [firstArg, ...rest] = forkCmd

    this.childProcess = nodecp.fork(firstArg, rest, {
      cwd: process.cwd(),
      stdio: 'pipe',
      env: {
        ...process.env,
        ...this.options.environmentAdditions,
        ...this.ttyLinker.parent.serialize(),
      },
    }) as nodecp.ChildProcessWithoutNullStreams

    this.ttyLinker.parent.forward(this.childProcess)

    this.childProcess.on('message', (msg: Message) => {
      if (msg.type === 'module_imported') {
        this.options.onRunnerImportedModule?.(msg.data)
      }
      if (msg.type === 'app_server_listening') {
        this.options.onServerListening?.()
      }
    })

    this.childProcess.stdout.on('data', (data) => {
      process.stdout.write(data)
    })

    this.childProcess.stderr.on('data', (data) => {
      process.stderr.write(data)
    })

    this.childProcess.once('error', (error) => {
      log.warn('runner errored out, respawning', { error })
      this.startOrRestart()
    })
  }
}

type StopResult = null | {
  code: null | number
  signal: null | NodeJS.Signals
}
