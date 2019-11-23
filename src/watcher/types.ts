import { ChildProcess, ForkOptions } from 'child_process'

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
  init: (opts: any) => void
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
  allDeps?: boolean
  deps?: boolean
  dedupe?: boolean
  poll?: boolean
  respawn?: boolean
  fast?: boolean
  disableWarnings?: boolean
  'disable-warnings'?: boolean
  'no-cache'?: boolean
  cache?: boolean
  clear?: boolean
  'type-check'?: boolean
  'transpile-only'?: boolean
  transpileOnly?: boolean
  files?: boolean
  pretty?: boolean
  'prefer-ts'?: boolean
  debug?: boolean
  'exit-child'?: boolean
}

interface StringOpts {
  compiler?: string
  project?: string
  ignore?: string | string[]
  'skip-project'?: string
  'skip-ignore'?: string
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
  eval: {
    code: string
    fileName: string
  }
}

export interface Opts extends BooleanOpts, StringOpts {
  log?: any
  watch?: string
  priorNodeArgs?: string[]
  callbacks?: Callbacks
  stdio?: ForkOptions['stdio']
}

export interface Process extends ChildProcess {
  respawn?: boolean
  stopping?: boolean
  exited: undefined | true
}
