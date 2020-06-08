import { Either, left, right } from 'fp-ts/lib/Either'
import * as fs from 'fs-jetpack'
import { addHook } from 'pirates'
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
): Either<Error, ts.EmitAndSemanticDiagnosticsBuilderProgram> {
  // Incremental option cannot be set when `noEmit: true`
  const compilerCacheOptions =
    options?.withCache && !layout.tsConfig.content.options.noEmit
      ? {
          tsBuildInfoFile: getTSIncrementalFilePath(layout),
          incremental: true,
        }
      : {}

  log.trace('Create TypeScript program')

  const builder = ts.createIncrementalProgram({
    rootNames: layout.nexusModules.concat(layout.app.exists ? [layout.app.path] : []),
    options: {
      ...compilerCacheOptions,
      ...layout.tsConfig.content.options,
      outDir: layout.build.tsOutputDir,
    },
  })

  // If the program has imports to modules outside the source root then TS out root will be forced
  // into an unexpected layout, and consequently the start module imports will fail. Check for this
  // specific kind of error now. All other error checking will be deferred until after typegen has been run however.
  // todo testme
  const SOURCE_ROOT_MUST_CONTAIN_ALL_SOURCE_FILES_ERROR_CODE = 6059
  const errors = ts.getPreEmitDiagnostics(builder.getProgram())
  const maybeSourceRootMustContainAllSourceFilesError = errors.find(
    (error) => error.code === SOURCE_ROOT_MUST_CONTAIN_ALL_SOURCE_FILES_ERROR_CODE
  )
  if (maybeSourceRootMustContainAllSourceFilesError) {
    const message =
      'Your app is invalid\n\n' +
      ts.formatDiagnosticsWithColorAndContext([maybeSourceRootMustContainAllSourceFilesError], diagnosticHost)
    return left(Error(message))
  }

  return right(builder)
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
export function emitTSProgram(
  builder: ts.EmitAndSemanticDiagnosticsBuilderProgram,
  layout: Layout,
  options?: CompileOptions
): void {
  if (options?.removePreviousBuild === true) {
    log.trace('remove previous build folder if present')
    fs.remove(layout.build.tsOutputDir)
  }

  log.trace('emit transpiled modules', { dest: layout.build.tsOutputDir })

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

class TSError extends Error {
  constructor(public message: string) {
    super(message)

    // Make sure `name` property is not enumerable
    // so that it doesn't end up in console.log
    Object.defineProperty(this, 'name', {
      value: 'TSError',
      enumerable: false,
    })
  }
}

function createTSError(diagnostics: ReadonlyArray<ts.Diagnostic>) {
  const diagnosticText = ts.formatDiagnosticsWithColorAndContext(diagnostics, diagnosticHost)

  return new TSError(`⨯ Unable to compile TypeScript:\n${diagnosticText}`)
}

/**
 * Allow node to require TypeScript modules, transpiling them on the fly.
 *
 * @remarks
 *
 * This is strictly about transpilation, no type checking is done.
 */
export function registerTypeScriptTranspile(compilerOptions?: ts.CompilerOptions) {
  addHook(
    (source, fileName) => {
      const transpiled = ts.transpileModule(source, {
        reportDiagnostics: true,
        fileName,
        compilerOptions,
      })

      if (transpiled.diagnostics && transpiled.diagnostics.length > 0) {
        throw createTSError(transpiled.diagnostics)
      }

      return transpiled.outputText
    },
    { exts: ['.ts'] }
  )
}
