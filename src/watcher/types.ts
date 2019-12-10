import { ChildProcess, ForkOptions } from 'child_process'
import { Layout } from '../framework/layout'
import * as Plugin from '../framework/plugin'

type EventRestart = {
  event: 'restart'
  file: string
}

type EventCompiled = {
  event: 'compiled'
  file: string
}

type EventLogging = {
  event: 'logging'
  data: string
}

type EventReady = {
  event: 'ready'
}

type Events = EventRestart | EventCompiled | EventLogging | EventReady

type OnEvent = (e: Events) => void

export interface Compiler {
  allowJs: boolean
  tsConfigPath: string
  getCompilationId: () => string
  createCompiledDir: () => void
  getCompiledDir: () => string
  getCompileReqFilePath: () => string
  getCompilerReadyFilePath: () => string
  getChildHookPath: () => string
  writeReadyFile: () => void
  writeChildHookFile: (opts: any) => void
  init: (opts: Opts) => void
  compileChanged: (fileName: string, onEvent: OnEvent) => void
  compile: (params: {
    compile: string
    compiledPath: string
    onEvent: OnEvent
  }) => void
  log?: any
  stop?: any
}

interface BooleanOpts {
  dedupe?: boolean
  respawn: boolean
  'no-cache'?: boolean
  clear?: boolean
  'type-check'?: boolean
  transpileOnly: boolean
  logError?: boolean
  files?: boolean
  pretty?: boolean
  'prefer-ts'?: boolean
  'prefer-ts-exts'?: boolean
  debug?: boolean
  'exit-child'?: boolean
  'skip-project'?: boolean
  'skip-ignore'?: boolean
}

interface StringOpts {
  compiler?: string
  project?: string
  ignore?: string | string[]
  ignoreWarnings?: string
  'ignore-warnings'?: string[]
  ignoreDiagnostics?: string[]
  'ignore-diagnostics'?: string[]
  'cache-directory'?: string
  compilerOptions?: string
  'compiler-options'?: string
  'compile-timeout'?: string
  'ignore-watch'?: string[]
  interval?: string
  debounce?: string
  nodeArgs?: string[]
}

export interface Opts extends BooleanOpts, StringOpts {
  layout: Layout
  log?: any
  watch?: string
  onEvent: OnEvent
  stdio?: ForkOptions['stdio']
  eval: {
    code: string
    fileName: string
  }
  plugins: Plugin.WorkflowContributions[]
}

export interface Process extends ChildProcess {
  respawn?: boolean
  stopping?: boolean
  exited: undefined | true
}
