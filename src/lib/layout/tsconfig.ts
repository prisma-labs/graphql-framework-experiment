import * as fs from 'fs-jetpack'
import * as Path from 'path'
import * as TypeFest from 'type-fest'
import * as ts from 'typescript'
import { rootLogger } from '../nexus-logger'
import { DEFAULT_BUILD_FOLDER_PATH_RELATIVE_TO_PROJECT_ROOT } from './layout'

const log = rootLogger.child('tsconfig')

const diagnosticHost: ts.FormatDiagnosticsHost = {
  getNewLine: () => ts.sys.newLine,
  getCurrentDirectory: () => process.cwd(),
  getCanonicalFileName: (path) => path,
}

export interface TsConfigJson extends TypeFest.TsConfigJson {
  compilerOptions: {
    outDir: string
    rootDir: string
  }
  include: string[]
}

export async function readOrScaffoldTsconfig(input: {
  projectRoot: string
  overrides?: { outRoot?: string }
}): Promise<TsConfigJson> {
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
    throw new Error(ts.formatDiagnosticsWithColorAndContext([tsconfigContent.error], diagnosticHost))
  }

  const tscfg = tsconfigContent.config

  // setup zero values

  if (!tscfg.compilerOptions) {
    tscfg.compilerOptions = {}
  }

  if (!tscfg.include) {
    tscfg.include = []
  }

  // setup source root

  if (!tscfg.compilerOptions!.rootDir) {
    tscfg.compilerOptions!.rootDir = '.'
    // todo scaffold
    log.warn(`Please set your tsconfig.json compilerOptions.rootDir to "${tscfg.compilerOptions!.rootDir}"`)
  }

  if (!tscfg.include.includes(tscfg.compilerOptions!.rootDir)) {
    tscfg.include.push(tscfg.compilerOptions!.rootDir)
    // todo scaffold
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

  // todo validate that no source modules fall outside source root

  log.trace('read', { tsconfig: tsconfig.raw })

  return tsconfig.raw
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
