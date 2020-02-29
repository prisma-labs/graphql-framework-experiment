import { ForkOptions } from 'child_process'
import { Layout } from '../framework/layout'
import * as Plugin from '../lib/plugin'

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

type Events = EventRestart | EventCompiled | EventLogging

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
  layout: Layout
  log?: any
  watch?: string
  stdio?: ForkOptions['stdio']
  eval: {
    code: string
    fileName: string
  }
  plugins: Plugin.WorkflowHooks[]
}
