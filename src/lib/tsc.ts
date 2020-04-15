import * as fs from 'fs-jetpack'
import * as ts from 'typescript'
import { Layout } from './layout'
import { rootLogger } from './nexus-logger'

const log = rootLogger.child('tsc')

interface ProgramOptions {
  withCache?: boolean
}

/**
 * Create a TypeScript program.
 */
export function createTSProgram(
  layout: Layout,
  options?: ProgramOptions
): ts.EmitAndSemanticDiagnosticsBuilderProgram {
  const compilerCacheOptions = options?.withCache
    ? {
        tsBuildInfoFile: getTSIncrementalFilePath(layout),
        incremental: true,
      }
    : {}

  log.trace('Create TypeScript program')

  const builder = ts.createIncrementalProgram({
    rootNames: layout.schemaModules.concat(layout.app.exists ? [layout.app.path] : []),
    options: {
      ...compilerCacheOptions,
      ...layout.tsConfigJson.options,
    },
  })

  const errors = ts.getPreEmitDiagnostics(builder.getProgram())

  // todo testme
  if (errors.length) {
    // Kind of errors here include when an import is from somewhere outside rootDir (and outDir is specified).
    log.fatal('Your app is invalid\n\n' + ts.formatDiagnosticsWithColorAndContext(errors, diagnosticHost))
    process.exit(1)
  }

  return builder
}

export function deleteTSIncrementalFile(layout: Layout) {
  fs.remove(getTSIncrementalFilePath(layout))
}

export function getTSIncrementalFilePath(layout: Layout) {
  return layout.projectPath('node_modules', '.nexus', 'cache.tsbuildinfo')
}

interface CompileOptions {
  skipTSErrors?: boolean
  removePreviousBuild?: boolean
}

/**
 * compile a program. Throws an error if the program does not type check.
 */
export function compile(
  builder: ts.EmitAndSemanticDiagnosticsBuilderProgram,
  layout: Layout,
  options?: CompileOptions
): void {
  if (options?.removePreviousBuild === true) {
    log.trace('remove previous build folder if present')
    fs.remove(layout.buildOutputRelative)
  }

  log.trace('emit transpiled modules')

  const emitResult = builder.emit()
  log.trace('done', { filesEmitted: emitResult.emittedFiles?.length ?? 0 })

  if (options?.skipTSErrors === true) {
    return
  }

  const allDiagnostics = ts.getPreEmitDiagnostics(builder.getProgram()).concat(emitResult.diagnostics)

  if (allDiagnostics.length > 0) {
    throw new Error(ts.formatDiagnosticsWithColorAndContext(allDiagnostics, diagnosticHost))
  }
}

/**
 * Transpile a TS module to JS.
 */
export function transpileModule(input: string, compilerOptions: ts.CompilerOptions): string {
  // todo use layout and get tsconfig settings from there?
  return ts.transpileModule(input, { compilerOptions }).outputText
}

const diagnosticHost: ts.FormatDiagnosticsHost = {
  getNewLine: () => ts.sys.newLine,
  getCurrentDirectory: () => process.cwd(),
  getCanonicalFileName: (path) => path,
}
