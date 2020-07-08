import { Either, left, right } from 'fp-ts/lib/Either'
import * as fs from 'fs-jetpack'
import * as path from 'path'
import { addHook } from 'pirates'
import slash from 'slash'
import * as sourceMapSupport from 'source-map-support'
import * as ts from 'typescript'
import { Layout } from './layout'
import { rootLogger } from './nexus-logger'
import { exception, Exception } from './utils'

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
): Either<Exception, ts.EmitAndSemanticDiagnosticsBuilderProgram> {
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
    return left(exception(message))
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
  const outputCache = new Map<
    string,
    {
      content: string
    }
  >()
  const options = compilerOptions ?? {}
  sourceMapSupport.install({
    environment: 'node',
    retrieveFile(path) {
      return outputCache.get(slash(path))?.content || ''
    },
  })

  /**
   * Get the extension for a transpiled file.
   */
  const getExtension =
    options.jsx === ts.JsxEmit.Preserve
      ? (path: string) => (/\.[tj]sx$/.test(path) ? '.jsx' : '.js')
      : (_: string) => '.js'

  addHook(
    (source, fileName) => {
      const transpiled = ts.transpileModule(source, {
        reportDiagnostics: true,
        fileName,
        compilerOptions: {
          ...options,
          sourceMap: true,
        },
      })

      if (transpiled.diagnostics && transpiled.diagnostics.length > 0) {
        throw createTSError(transpiled.diagnostics)
      }

      const normalizedFileName = slash(fileName)
      const output = updateOutput(
        transpiled.outputText,
        normalizedFileName,
        transpiled.sourceMapText!,
        getExtension
      )
      outputCache.set(normalizedFileName, { content: output })

      return transpiled.outputText
    },
    { exts: ['.ts'] }
  )
}

/**
 * Update the output remapping the source map.
 * Taken from ts-node
 */
function updateOutput(
  outputText: string,
  fileName: string,
  sourceMap: string,
  getExtension: (fileName: string) => string
) {
  const base64Map = Buffer.from(updateSourceMap(sourceMap, fileName), 'utf8').toString('base64')
  const sourceMapContent = `data:application/json;charset=utf-8;base64,${base64Map}`
  const sourceMapLength =
    `${path.basename(fileName)}.map`.length + (getExtension(fileName).length - path.extname(fileName).length)

  return outputText.slice(0, -sourceMapLength) + sourceMapContent
}

/**
 * Update the source map contents for improved output.
 * Taken from ts-node
 */
function updateSourceMap(sourceMapText: string, fileName: string) {
  const sourceMap = JSON.parse(sourceMapText)
  sourceMap.file = fileName
  sourceMap.sources = [fileName]
  delete sourceMap.sourceRoot
  return JSON.stringify(sourceMap)
}
