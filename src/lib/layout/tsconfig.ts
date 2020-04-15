import * as fs from 'fs-jetpack'
import * as Path from 'path'
import { TsConfigJson } from 'type-fest'
import * as ts from 'typescript'
import { rootLogger } from '../nexus-logger'
import { DEFAULT_BUILD_FOLDER_PATH_RELATIVE_TO_PROJECT_ROOT } from './layout'

const log = rootLogger.child('tsconfig')

const diagnosticHost: ts.FormatDiagnosticsHost = {
  getNewLine: () => ts.sys.newLine,
  getCurrentDirectory: () => process.cwd(),
  getCanonicalFileName: (path) => path,
}

export async function readOrScaffoldTsconfig(input: {
  projectRoot: string
  overrides?: { outRoot?: string }
}): Promise<ts.ParsedCommandLine> {
  let tsconfigPath = ts.findConfigFile(input.projectRoot, ts.sys.fileExists, 'tsconfig.json')

  if (!tsconfigPath) {
    tsconfigPath = Path.join(input.projectRoot, 'tsconfig.json')
    const tsconfigContent = tsconfigTemplate({
      sourceRootRelative: '.',
      outRootRelative: DEFAULT_BUILD_FOLDER_PATH_RELATIVE_TO_PROJECT_ROOT,
    })
    log.warn('We could not find a "tsconfig.json" file')
    log.warn(`We scaffolded one for you at ${tsconfigPath}`)
    await fs.writeAsync(tsconfigPath, tsconfigContent)
  }

  const projectRoot = Path.dirname(tsconfigPath)

  const tsconfigContent = ts.readConfigFile(tsconfigPath, ts.sys.readFile)

  if (tsconfigContent.error) {
    log.fatal(
      'Unable to read your tsconifg.json\n\n' +
        ts.formatDiagnosticsWithColorAndContext([tsconfigContent.error], diagnosticHost)
    )
    process.exit(1)
  }

  const tscfg: TsConfigJson = tsconfigContent.config

  // setup zero values

  if (!tscfg.compilerOptions) {
    tscfg.compilerOptions = {}
  }

  if (!tscfg.include) {
    tscfg.include = []
  } else if (!Array.isArray(tscfg.include)) {
    // If the include is present but not array it must mean a mal-formed tsconfig.
    // Exit early, if we contintue we will have a runtime error when we try .push on a non-array.
    // todo testme once we're not relying on mock process exit
    checkNoTsConfigErrors(ts.parseJsonConfigFileContent(tscfg, ts.sys, projectRoot, undefined, tsconfigPath))
  }

  // Lint

  if (tscfg.compilerOptions.tsBuildInfoFile) {
    delete tscfg.compilerOptions.tsBuildInfoFile
    log.warn(
      'You have set compilerOptions.tsBuildInfoFile in your tsconfig.json but it will be ignored by Nexus. Nexus manages this value internally.'
    )
  }

  if (tscfg.compilerOptions.incremental) {
    delete tscfg.compilerOptions.incremental
    log.warn(
      'You have set compilerOptions.incremental in your tsconfig.json but it will be ignored by Nexus. Nexus manages this value internally.'
    )
  }

  // setup source root

  if (!tscfg.compilerOptions!.rootDir) {
    tscfg.compilerOptions!.rootDir = '.'
    log.warn(`Please set your tsconfig.json compilerOptions.rootDir to "${tscfg.compilerOptions!.rootDir}"`)
  }

  if (!tscfg.include.includes(tscfg.compilerOptions!.rootDir!)) {
    tscfg.include.push(tscfg.compilerOptions!.rootDir!)
    log.warn(`Please set your tsconfig.json include to have "${tscfg.compilerOptions!.rootDir}"`)
  }

  // setup out root

  if (input.overrides?.outRoot !== undefined) {
    tscfg.compilerOptions.outDir = input.overrides.outRoot
  } else if (!tscfg.compilerOptions.outDir) {
    tscfg.compilerOptions.outDir = DEFAULT_BUILD_FOLDER_PATH_RELATIVE_TO_PROJECT_ROOT
  }

  // check it

  const tsconfig = ts.parseJsonConfigFileContent(tscfg, ts.sys, projectRoot, undefined, tsconfigPath)

  checkNoTsConfigErrors(tsconfig)

  log.trace('read', { tsconfig: tsconfig })

  return tsconfig
}

function checkNoTsConfigErrors(tsconfig: ts.ParsedCommandLine) {
  if (tsconfig.errors.length > 0) {
    // Kinds of errors include type validations like if include field is an array.
    log.fatal(
      'Your tsconfig.json is invalid\n\n' +
        ts.formatDiagnosticsWithColorAndContext(tsconfig.errors, diagnosticHost)
    )
    process.exit(1)
  }
}

export function tsconfigTemplate(input: { sourceRootRelative: string; outRootRelative: string }): string {
  // Render empty source root as '.' which is what node path module relative func will do when same dir.
  const sourceRelative = input.sourceRootRelative || '.'
  return JSON.stringify(
    {
      compilerOptions: {
        target: 'es2016',
        module: 'commonjs',
        lib: ['esnext'],
        strict: true,
        rootDir: sourceRelative,
        outDir: input.outRootRelative,
      },
      include: [sourceRelative],
    },
    null,
    2
  )
}
