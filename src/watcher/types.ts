import { ChildProcess, ForkOptions } from 'child_process'
import { Layout } from '../framework/layout'

export interface Callbacks {
  onEvent?: (
    event: 'start' | 'restart' | 'compiled' | 'logging' | 'ready',
    data?: string
  ) => void
}

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
  compileChanged: (fileName: string, callbacks: Callbacks) => void
  compile: (params: {
    compile: string
    compiledPath: string
    callbacks: Callbacks
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
}

export interface Opts extends BooleanOpts, StringOpts {
  layout: Layout
  log?: any
  watch?: string
  priorNodeArgs?: string[]
  callbacks?: Callbacks
  stdio?: ForkOptions['stdio']
  eval: {
    code: string
    fileName: string
  }
}

export interface Process extends ChildProcess {
  respawn?: boolean
  stopping?: boolean
  exited: undefined | true
}
