import * as ts from 'typescript'
import * as path from 'path'
import { BUILD_FOLDER_NAME } from '../constants'

const diagnosticHost: ts.FormatDiagnosticsHost = {
  getNewLine: () => ts.sys.newLine,
  getCurrentDirectory: () => process.cwd(),
  getCanonicalFileName: path => path,
}

export function findConfigFile(
  fileName: string,
  opts: { required: true }
): string
export function findConfigFile(
  fileName: string,
  opts: { required: false }
): string | undefined

/**
 * Find a config file
 */
export function findConfigFile(fileName: string, opts: { required: boolean }) {
  const configPath = ts.findConfigFile(
    /*searchPath*/ process.cwd(),
    ts.sys.fileExists,
    fileName
  )

  if (!configPath) {
    if (opts.required === true) {
      throw new Error(`Could not find a valid '${fileName}'.`)
    } else {
      return undefined
    }
  }

  return configPath
}

function fixConfig(config: ts.ParsedCommandLine, projectDir: string) {
  // Otherwise user gets an error caused by out utils/log.ts module
  // Remove this and see the build integration test fail for example
  if (config.options.esModuleInterop === undefined) {
    config.options.esModuleInterop = true
  }

  // Target ES5 output by default (instead of ES3).
  if (config.options.target === undefined) {
    config.options.target = ts.ScriptTarget.ES5
  }

  // Target CommonJS modules by default (instead of magically switching to ES6 when the target is ES6).
  if (config.options.module === undefined) {
    config.options.module = ts.ModuleKind.CommonJS
  }

  if (config.options.outDir === undefined) {
    config.options.outDir = BUILD_FOLDER_NAME
  }

  // config.options.rootDir = projectDir

  return config
}

export function readTsConfig() {
  const tsConfigPath = findConfigFile('tsconfig.json', { required: true })
  const projectDir = path.dirname(tsConfigPath)
  const tsConfigContent = ts.readConfigFile(tsConfigPath, ts.sys.readFile)

  if (tsConfigContent.error) {
    throw new Error(
      ts.formatDiagnosticsWithColorAndContext(
        [tsConfigContent.error],
        diagnosticHost
      )
    )
  }

  const inputConfig = ts.parseJsonConfigFileContent(
    tsConfigContent.config,
    ts.sys,
    projectDir,
    undefined,
    tsConfigPath
  )
  return fixConfig(inputConfig, projectDir)
}

export function compile(rootNames: string[], options: ts.CompilerOptions) {
  const program = ts.createProgram({
    rootNames,
    options,
  })

  const emitResult = program.emit()
  const allDiagnostics = ts
    .getPreEmitDiagnostics(program)
    .concat(emitResult.diagnostics)

  if (allDiagnostics.length > 0) {
    throw new Error(
      ts.formatDiagnosticsWithColorAndContext(allDiagnostics, diagnosticHost)
    )
  }
}

export function transpileModule(
  input: string,
  compilerOptions: ts.CompilerOptions
): string {
  return ts.transpileModule(input, { compilerOptions }).outputText
}
