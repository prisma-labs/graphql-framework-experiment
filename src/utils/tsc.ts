import * as fs from 'fs-jetpack'
import * as path from 'path'
import * as ts from 'typescript'
import { BUILD_FOLDER_NAME } from '../constants'
import { Layout } from '../framework/layout'
import { findProjectDir } from './path'
import chalk = require('chalk')
import { stripIndent } from 'common-tags'
import { pog } from './pog'
import { removeWrite } from './fs'

const log = pog.sub('compiler')

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

/**
 * compile a program
 */
export function compile(rootNames: string[], options: ts.CompilerOptions) {
  const program = ts.createProgram({
    rootNames,
    options,
  })

  const checker = program.getTypeChecker()
  runCompilerExtensions({ program, checker })

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

/**
 * Run our custom compiler extension features, like extracting context types
 * from all `addContext` calls.
 */
export function runCompilerExtensions({
  checker,
  program,
}: {
  checker: ts.TypeChecker
  program: ts.Program
}): void {
  const contextTypeContributions: string[] = []

  program.getSourceFiles().forEach(visit)

  log('finished compiler extension processing with results %O', {
    contextTypeContributions,
  })

  if (contextTypeContributions.length > 0) {
    removeWrite(
      'node_modules/@types/typegen-pumpkins-add-context/index.d.ts',
      stripIndent`
        export type Context = ${contextTypeContributions.join(' & ')}
      `
    )
  }

  /**
   * Given a node, traverse the tree of nodes under it.
   */
  function visit(n: ts.Node) {
    if (ts.isCallExpression(n)) {
      const lastToken = n.expression.getLastToken()
      if (
        lastToken !== undefined &&
        ts.isIdentifier(lastToken) &&
        // TODO use id.unescapedText
        lastToken.escapedText === 'addContext'
      ) {
        log('found addContext call %o', lastToken.getFullText())

        // Get the argument passed too addContext so we can extract its type
        const args = n.arguments
        if (args.length === 0) {
          log(
            'no arguments passed to addContext, this is wrong, stopping context type extraction'
          )
          return
        }
        if (args.length > 1) {
          log(
            'multiple arguments passed to addContext, this is wrong, stopping context type extraction'
          )
          return
        }
        const arg = args[0]
        log('found addContext arg %o', arg.getFullText())

        // Get the signature of the argument so we can extract its return type
        const argType = checker.getTypeAtLocation(arg)
        const argSigs = argType.getCallSignatures()
        if (argSigs.length === 0) {
          log(
            'argument passed to addContext had no signatures, this is wrong, stopping context type extraction'
          )
          return
        }
        if (argSigs.length > 1) {
          log(
            'argument passed to addContext has more than one signature, this might be wrong, stopping context type extraction'
          )
          return
        }
        const argSig = argSigs[0]

        const retType = checker.getReturnTypeOfSignature(argSig)
        const retTypeString = checker.typeToString(retType)
        contextTypeContributions.push(retTypeString)
      }
    } else {
      n.forEachChild(visit)
    }
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
        "compilerOptions": {
          "target": "es2016",
          "module": "commonjs",
          "lib": ["esnext"],
          "strict": true,
          //
          // The following settings are managed by Pumpkins.
          // Do not edit these manually. Please refer to
          // https://github.com/prisma/pumpkins/issues/82
          // Contribute feedback/use-cases if you feel strongly
          // about controlling these settings manually.
          //
          // "rootDir": "${path.relative(projectDir, layout.sourceRoot)}",
          // "outDir": "${BUILD_FOLDER_NAME}",
          //
        }
      }
    `
    const tsConfigPath = path.join(projectDir, 'tsconfig.json')
    await fs.writeAsync(tsConfigPath, tsConfigContent)
    return 'warning'
  }

  return 'success'
}
