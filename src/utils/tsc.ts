import * as fs from 'fs-jetpack'
import * as path from 'path'
import * as ts from 'typescript'
import { BUILD_FOLDER_NAME } from '../constants'
import { Layout } from '../framework/layout'
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

/**
 * Fetch the tsconfig file for pumpkins, handling special post-processing for
 * pumpkins projects etc.
 */
export function readTsConfig(layout: Layout): ts.ParsedCommandLine {
  const tsConfigPath = findConfigFile('tsconfig.json', { required: true })
  const tsConfigContent = ts.readConfigFile(tsConfigPath, ts.sys.readFile)

  if (tsConfigContent.error) {
    throw new Error(
      ts.formatDiagnosticsWithColorAndContext(
        [tsConfigContent.error],
        diagnosticHost
      )
    )
  }

  /**
   * Only consider modules within our source root so that non-app TS files (e.g.
   * prisma/seed.ts) do not get include into the  scope of compiler work (by
   * default it will be) which then leads to unexpected emit folder structures or complaining that there are included files outside of `rootDir`.
   *
   * Note that the reason this is not part of the post-parse fixing (which is
   * type-safe) is that TS API will execute on files/include/exlcude during the
   * parse phase. So we need to work our conventions for this config BEFORE the
   * parse. More detail cabout this nuance can be found in this Stack-Overflow thread:
   *
   * https://stackoverflow.com/questions/57333825/can-you-pull-in-excludes-includes-options-in-typescript-compiler-api
   *
   */
  if (tsConfigContent.config.include === undefined) {
    tsConfigContent.config.include = [layout.sourceRootRelative]
  }

  const inputConfig = ts.parseJsonConfigFileContent(
    tsConfigContent.config,
    ts.sys,
    layout.projectRoot,
    undefined,
    tsConfigPath
  )

  /**
   * Force tsconfig settings in ways that align with pumpkins projects.
   */

  // Target ES5 output by default (instead of ES3).
  if (inputConfig.options.target === undefined) {
    inputConfig.options.target = ts.ScriptTarget.ES5
  }

  // Target CommonJS modules by default (instead of magically switching to ES6 when the target is ES6).
  if (inputConfig.options.module === undefined) {
    inputConfig.options.module = ts.ModuleKind.CommonJS
  }

  if (inputConfig.options.outDir === undefined) {
    inputConfig.options.outDir = BUILD_FOLDER_NAME
  }

  if (inputConfig.options.rootDir === undefined) {
    inputConfig.options.rootDir = layout.sourceRoot
  }

  return inputConfig
}

export function createTSProgram(
  layout: Layout
): ts.EmitAndSemanticDiagnosticsBuilderProgram {
  const tsConfig = readTsConfig(layout)
  const program = ts.createIncrementalProgram({
    rootNames: tsConfig.fileNames,
    options: {
      incremental: true,
      tsBuildInfoFile: './node_modules/.pumpkins/cache.tsbuildinfo',
      ...tsConfig.options,
    },
  })
  return program
}

/**
 * compile a program
 */
export function compile(
  program: ts.EmitAndSemanticDiagnosticsBuilderProgram
): void {
  log('remove previous build folder if present...')
  fs.remove(BUILD_FOLDER_NAME)
  log('done')
  log('emit transpiled modules to disk...')
  const emitResult = program.emit()
  log('done - %s files emitted', emitResult.emittedFiles?.length ?? 0)
  const allDiagnostics = ts
    .getPreEmitDiagnostics(program.getProgram())
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
export function extractContextTypes(
  program: ts.EmitAndSemanticDiagnosticsBuilderProgram
): string[] {
  const checker = program.getProgram().getTypeChecker()
  const contextTypeContributions: string[] = []

  program.getSourceFiles().forEach(visit)

  log('finished compiler extension processing with results %O', {
    contextTypeContributions,
  })

  return contextTypeContributions

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

  if (tsConfigPath) {
    if (path.dirname(tsConfigPath) !== layout.projectRoot) {
      console.error(
        chalk`{red ERROR:} Your tsconfig.json file needs to be in your project root directory`
      )
      console.error(
        chalk`{red ERROR:} Found ${tsConfigPath}, expected ${path.join(
          layout.projectRoot,
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
    const scaffoldPath = layout.projectRelative('tsconfig.json')
    console.log(stripIndent`
      ${chalk.yellow('Warning:')} We could not find a "tsconfig.json" file.
      ${chalk.yellow('Warning:')} We scaffolded one for you at ${scaffoldPath}.
    `)

    // It seems we cannot make `include` a comment below, because it is
    // evaluated at tsconfig read time, see this Stack-Overflow thread:
    // https://stackoverflow.com/questions/57333825/can-you-pull-in-excludes-includes-options-in-typescript-compiler-api
    //
    await fs.writeAsync(scaffoldPath, createTSConfigContents(layout))
    return 'warning'
  }

  return 'success'
}

export function createTSConfigContents(layout: Layout): string {
  return stripIndent`
    {
      "compilerOptions": {
        "target": "es2016",
        "module": "commonjs",
        "lib": ["esnext"],
        "strict": true,
        // [1] pumpkins managed
        // "rootDir": "${layout.sourceRootRelative}",
        // "outDir": "${BUILD_FOLDER_NAME}",
      },
      // [1] pumpkins managed
      // "include": "${layout.sourceRootRelative}"
    }

    // [1] pumpkins managed
    //
    // These settings are managed by Pumpkins.
    // Do not edit these manually. Please refer to
    // https://github.com/prisma/pumpkins/issues/82
    // Contribute feedback/use-cases if you feel strongly
    // about controlling these settings manually.
  `
}
