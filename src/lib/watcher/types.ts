import { ForkOptions } from 'child_process'
import * as Plugin from '../plugin'

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
  compileChanged: (fileName: string) => void
  compile: (params: { compile: string; compiledPath: string }) => void
  log?: any
  stop?: any
}

interface BooleanOpts {
  dedupe?: boolean
  'no-cache'?: boolean
  clear?: boolean
  'type-check'?: boolean
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
  sourceRoot: string
  log?: any
  watch?: string
  stdio?: ForkOptions['stdio']
  plugins: Plugin.WorktimeHooks[]
  /**
   * Port on which the debugger should listen to
   */
  inspectBrk?: number
}
