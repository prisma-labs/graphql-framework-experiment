import { stripIndent } from 'common-tags'
import * as fs from 'fs-jetpack'
import * as path from 'path'
import * as ts from 'typescript'
import { Layout } from './layout'
import { rootLogger } from './nexus-logger'

const log = rootLogger.child('compiler')

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
): string | null

/**
 * Find a config file. If required but not found, then an error is raised. If
 * not required and not found then null is returned.
 */
export function findConfigFile(fileName: string, opts: { required: boolean }) {
  const configPath = ts.findConfigFile(
    /*searchPath*/ process.cwd(),
    ts.sys.fileExists,
    fileName
  )

  log.trace('config file serach result', { fileName, configPath, opts })

  if (!configPath) {
    if (opts.required === true) {
      throw new Error(`Could not find a valid '${fileName}'.`)
    } else {
      return null
    }
  }

  return configPath
}

/**
 * Fetch the tsconfig file for nexus, handling special post-processing for
 * nexus projects etc.
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
   * Force tsconfig settings in ways that align with nexus projects.
   */

  // Target ES5 output by default (instead of ES3).
  if (inputConfig.options.target === undefined) {
    inputConfig.options.target = ts.ScriptTarget.ES5
  }

  // Target CommonJS modules by default (instead of magically switching to ES6 when the target is ES6).
  if (inputConfig.options.module === undefined) {
    inputConfig.options.module = ts.ModuleKind.CommonJS
  }

  // TODO Seems wrong. If anything, layout module should encapsulate the logic
  // of honuring outDir, if we really want that. Hmmm...
  if (inputConfig.options.outDir === undefined) {
    inputConfig.options.outDir = layout.buildOutput
  }

  if (inputConfig.options.rootDir === undefined) {
    inputConfig.options.rootDir = layout.sourceRoot
  }

  return inputConfig
}

export function createTSProgram(
  layout: Layout,
  opts?: {
    withCache?: boolean
  }
): ts.EmitAndSemanticDiagnosticsBuilderProgram {
  const tsConfig = readTsConfig(layout)
  const cacheOptions = opts?.withCache
    ? {
        tsBuildInfoFile: getTSIncrementalFilePath(layout),
        incremental: true,
      }
    : {}

  const program = ts.createIncrementalProgram({
    rootNames: tsConfig.fileNames,
    options: {
      ...cacheOptions,
      ...tsConfig.options,
    },
  })
  return program
}

export function deleteTSIncrementalFile(layout: Layout) {
  fs.remove(getTSIncrementalFilePath(layout))
}

export function getTSIncrementalFilePath(layout: Layout) {
  return layout.projectPath('node_modules', '.nexus', 'cache.tsbuildinfo')
}

/**
 * compile a program. Throws an error if the program does not type check.
 */
export function compile(
  program: ts.EmitAndSemanticDiagnosticsBuilderProgram,
  layout: Layout,
  opts?: { skipTSErrors?: boolean; removePreviousBuild?: boolean }
): void {
  if (opts?.removePreviousBuild === true) {
    log.trace('remove previous build folder if present...')
    fs.remove(layout.buildOutput)
  }

  log.trace('done')
  log.trace('emit transpiled modules to disk...')
  const emitResult = program.emit()
  log.trace('done', { filesEmitted: emitResult.emittedFiles?.length ?? 0 })

  if (opts?.skipTSErrors === true) {
    return
  }

  const allDiagnostics = ts
    .getPreEmitDiagnostics(program.getProgram())
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

  if (tsConfigPath) {
    if (path.dirname(tsConfigPath) !== layout.projectRoot) {
      log.error(
        `Your tsconfig.json file needs to be in your project root directory`
      )
      log.error(
        `Found ${tsConfigPath}, expected ${path.join(
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
    log.warn('We could not find a "tsconfig.json" file')
    log.warn(`We scaffolded one for you at ${scaffoldPath}`)

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
        // [1] nexus managed
        // "rootDir": "${layout.sourceRootRelative}",
        // "outDir": "${layout.buildOutput}",
      },
      // [1] nexus managed
      // "include": "${layout.sourceRootRelative}"
    }

    // [1] nexus managed
    //
    // These settings are managed by nexus.
    // Do not edit these manually. Please refer to
    // https://github.com/graphql-nexus/nexus-future/issues/82
    // Contribute feedback/use-cases if you feel strongly
    // about controlling these settings manually.
  `
}
