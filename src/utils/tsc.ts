import * as fs from 'fs-jetpack'
import * as path from 'path'
import * as ts from 'typescript'
import { BUILD_FOLDER_NAME } from '../constants'
import { Layout } from '../framework/layout'
import { findProjectDir } from './path'
import chalk = require('chalk')
import { stripIndent } from 'common-tags'

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

/**
 * Find or scaffold a tsconfig.json file
 * Process will exit if package.json is not in the projectDir**
 */
export async function findOrScaffoldTsConfig(
  layout: Layout,
  options: { exitAfterError: boolean } = { exitAfterError: true }
): Promise<'success' | 'warning' | 'error'> {
  const tsConfigPath = findConfigFile('tsconfig.json', { required: false })
  const projectDir = findProjectDir()

  if (tsConfigPath) {
    if (path.dirname(tsConfigPath) !== projectDir) {
      console.error(
        chalk`{red ERROR:} Your tsconfig.json file needs to be in your project root directory`
      )
      console.error(
        chalk`{red ERROR:} Found ${tsConfigPath}, expected ${path.join(
          projectDir,
          'tsconfig.json'
        )}`
      )
      if (options.exitAfterError) {
        process.exit(1)
      } else {
        return 'error'
      }
    }
  }

  if (!tsConfigPath) {
    console.log(`
${chalk.yellow('Warning:')} We could not find a "tsconfig.json" file.
${chalk.yellow('Warning:')} We scaffolded one for you at ${path.join(
      projectDir,
      'tsconfig.json'
    )}.
    `)

    const tsConfigContent = stripIndent`
      {
        "target": "es2016",
        "module": "commonjs",
        "lib": ["esnext"],
        "strict": true,
        //
        // The following settings are managed by Pumpkins, do not edit these
        // manually. Please refer to
        // https://github.com/prisma/pumpkins/issues/82 and contribute
        // feedback/use-cases if you feel strongly about controlling these
        // settings manually.
        //
        // "rootDir": "${path.relative(projectDir, layout.sourceRoot)}",
        // "outDir": "${BUILD_FOLDER_NAME}",
      }
    `
    const tsConfigPath = path.join(projectDir, 'tsconfig.json')
    await fs.writeAsync(tsConfigPath, tsConfigContent)
    return 'warning'
  }

  return 'success'
}
