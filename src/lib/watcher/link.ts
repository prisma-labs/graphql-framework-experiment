import * as nodecp from 'child_process'
import { rootLogger } from '../nexus-logger'
import * as TTYLinker from '../tty-linker'
import { Message, ModuleRequiredMessage } from './ipc'

const log = rootLogger.child('dev').child('link')

interface ChangeableOptions {
  environmentAdditions?: Record<string, string>
  entrypointScript?: string
}

interface Options extends ChangeableOptions {
  entrypointScript: string
  onRunnerImportedModule?: (data: ModuleRequiredMessage['data']) => void
  onServerListening?: () => Promise<void>
  onRunnerStdioMessage?: (e: { stdio: 'stdout' | 'stderr'; data: string }) => void
  /**
   * Host and/or port on which the debugger should listen to
   */
  inspectBrk?: string
}

type StopResult = null | {
  code: null | number
  signal: null | NodeJS.Signals
}

type State = 'init' | 'running' | 'stopping' | 'stopped'

export class Link {
  private ttyLinker: null | TTYLinker.TTYLinker = null
  private state: State = 'init'
  private stoppedResult: StopResult | null = null
  private childProcess: null | nodecp.ChildProcessWithoutNullStreams = null

  constructor(private options: Options) {
    if (process.stdout.isTTY) {
      this.ttyLinker = TTYLinker.create()
    }
  }

  updateOptions(options: ChangeableOptions) {
    this.options = {
      ...this.options,
      ...options,
    }
  }

  async startOrRestart() {
    log.trace('startOrRestart requested', { state: this.state })

    if (this.childProcess) {
      await this.stop()
    }

    this.spawnRunner()
  }

  async stop() {
    log.trace('stop requested', { state: this.state })

    if (this.state === 'stopped') {
      log.trace('child is already stopped', { state: this.state })
      return
    }

    if (this.state === 'stopping') {
      log.trace('child is already stopping', { state: this.state })
      return
    }

    await this.kill()
  }

  private async kill(): Promise<StopResult> {
    if (this.state === 'stopped') {
      return this.stoppedResult
    }

    this.state = 'stopping'
    log.trace('killing child', { state: this.state })

    return new Promise<StopResult>((res) => {
      if (!this.childProcess) {
        log.trace('child already killed', { state: this.state })
        return res(null)
      }

      this.childProcess.kill('SIGKILL')
      this.childProcess.once('exit', (code, signal) => {
        log.trace('child killed', { state: this.state, code, signal })
        this.teardownChildProcess()
        res({ code, signal })
      })
    })
  }

  private teardownChildProcess() {
    this.ttyLinker?.parent.unforward(this.childProcess!)
    this.childProcess = null
    this.state = 'stopped'
  }

  private spawnRunner(): void {
    if (this.state !== 'stopped' && this.state !== 'init') {
      log.trace('cannot start the runner if it is not stopped', { state: this.state })
      return
    }

    if (this.childProcess) {
      throw new Error('attempt to spawn while previous child process still exists')
    }

    const forkCmd: string[] = []

    if (this.options.inspectBrk) {
      forkCmd.push(`--inspect-brk=${this.options.inspectBrk}`)
    }

    forkCmd.push(require.resolve('./runner'))

    const [firstArg, ...rest] = forkCmd

    this.childProcess = nodecp.fork(firstArg, rest, {
      cwd: process.cwd(),
      stdio: 'pipe',
      env: {
        ...process.env,
        ...this.options.environmentAdditions,
        ...(this.ttyLinker?.parent.serialize() ?? {}),
        ENTRYPOINT_SCRIPT: this.options.entrypointScript,
      },
    }) as nodecp.ChildProcessWithoutNullStreams

    log.trace('spawn child', { pid: this.childProcess.pid, state: this.state })

    this.ttyLinker?.parent.forward(this.childProcess)

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
      this.options.onRunnerStdioMessage?.({ stdio: 'stdout', data: data.toString() })
    })

    this.childProcess.stderr.on('data', (data) => {
      process.stderr.write(data)
      this.options.onRunnerStdioMessage?.({ stdio: 'stderr', data: data.toString() })
    })

    this.childProcess.once('error', (error) => {
      log.warn('runner errored out, respawning', { error })
      this.startOrRestart()
    })

    this.childProcess.once('exit', (code, signal) => {
      log.trace('child killed itself', { state: this.state, code, signal })
      this.teardownChildProcess()
    })

    this.state = 'running'
  }
}
