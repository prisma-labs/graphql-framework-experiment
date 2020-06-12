import chalk from 'chalk'
import { stripIndent } from 'common-tags'
import * as fs from 'fs-jetpack'
import { EOL } from 'os'
import * as Path from 'path'
import { TsConfigJson } from 'type-fest'
import * as ts from 'typescript'
import { rootLogger } from '../nexus-logger'
import { DEFAULT_BUILD_DIR_PATH_RELATIVE_TO_PROJECT_ROOT } from './build'

export const NEXUS_TS_LSP_IMPORT_ID = 'nexus/typescript-language-service'

const log = rootLogger.child('tsconfig')

const diagnosticHost: ts.FormatDiagnosticsHost = {
  getNewLine: () => ts.sys.newLine,
  getCurrentDirectory: () => process.cwd(),
  getCanonicalFileName: (path) => path,
}

export async function readOrScaffoldTsconfig(input: {
  projectRoot: string
  overrides?: { outRoot?: string }
}): Promise<{ content: ts.ParsedCommandLine; path: string }> {
  let tsconfigPath = ts.findConfigFile(input.projectRoot, ts.sys.fileExists, 'tsconfig.json')

  if (!tsconfigPath) {
    tsconfigPath = Path.join(input.projectRoot, 'tsconfig.json')
    const tsconfigContent = tsconfigTemplate({
      sourceRootRelative: '.',
      outRootRelative: DEFAULT_BUILD_DIR_PATH_RELATIVE_TO_PROJECT_ROOT,
    })
    log.warn('We could not find a "tsconfig.json" file')
    log.warn(`We scaffolded one for you at ${tsconfigPath}`)
    await fs.writeAsync(tsconfigPath, tsconfigContent)
  }

  const projectRoot = Path.dirname(tsconfigPath)

  const tscfgReadResult = ts.readConfigFile(tsconfigPath, ts.sys.readFile)

  if (tscfgReadResult.error) {
    log.fatal(
      'Unable to read your tsconifg.json\n\n' +
        ts.formatDiagnosticsWithColorAndContext([tscfgReadResult.error], diagnosticHost)
    )
    process.exit(1)
  }

  const tscfg: TsConfigJson = tscfgReadResult.config

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

  if (tscfg.compilerOptions.plugins && tscfg.compilerOptions.plugins.length) {
    if (!tscfg.compilerOptions.plugins.map((p) => p.name).includes('nexus/typescript-language-service')) {
      const pluginsFixed = tscfg.compilerOptions.plugins.concat([{ name: NEXUS_TS_LSP_IMPORT_ID }])
      log.warn(
        stripIndent`
          You have not added the Nexus TypeScript Language Service Plugin to your configured TypeScript plugins. Add this to your compilerOptions:

              ${chalk.yellowBright(`"plugins": ${JSON.stringify(pluginsFixed)}`)}
        ` + EOL
      )
    }
  } else {
    log.warn(
      stripIndent`
        You have not setup the Nexus TypeScript Language Service Plugin. Add this to your compiler options:

            "plugins": [{ "name": "${NEXUS_TS_LSP_IMPORT_ID}" }]
      ` + EOL
    )
  }

  if (tscfg.compilerOptions.tsBuildInfoFile) {
    delete tscfg.compilerOptions.tsBuildInfoFile
    const setting = renderSetting(`compilerOptions.tsBuildInfoFile`)
    log.warn(`You have set ${setting} but it will be ignored by Nexus. Nexus manages this value internally.`)
  }

  if (tscfg.compilerOptions.incremental) {
    delete tscfg.compilerOptions.incremental
    const setting = renderSetting('compilerOptions.incremental')
    log.warn(`You have set ${setting} but it will be ignored by Nexus. Nexus manages this value internally.`)
  }

  const { typeRoots, types } = tscfg.compilerOptions
  if (typeRoots || types) {
    if (typeRoots) delete tscfg.compilerOptions.typeRoots
    if (types) delete tscfg.compilerOptions.types
    const settingsSet =
      typeRoots && types
        ? `${renderSetting('compilerOptions.typeRoots')} and ${renderSetting('compilerOptions.types')}`
        : typeRoots
        ? renderSetting('compilerOptions.typeRoots')
        : renderSetting('compilerOptions.types')
    const itThem = typeRoots && types ? 'them' : 'it'
    const thisThese = typeRoots && types ? 'these' : 'this'
    const s = typeRoots && types ? 's' : ''
    log.error(
      `You have set ${settingsSet} but Nexus does not support ${itThem}. If you do not remove your customization you may/will (e.g. VSCode) see inconsistent results between your IDE and what Nexus tells you at build time. If you would like to see Nexus support ${thisThese} setting${s} please chime in at https://github.com/graphql-nexus/nexus/issues/1036.`
    )
  }

  /**
   * Setup source root (aka. rootDir)
   */

  if (!tscfg.compilerOptions!.rootDir) {
    tscfg.compilerOptions!.rootDir = '.'
    const setting = renderSetting('compilerOptions.rootDir')
    log.warn(`Please set ${setting} to "${tscfg.compilerOptions!.rootDir}"`)
  }

  if (!tscfg.include.includes(tscfg.compilerOptions!.rootDir!)) {
    tscfg.include.push(tscfg.compilerOptions!.rootDir!)
    const setting = renderSetting('include')
    log.warn(`Please set ${setting} to have "${tscfg.compilerOptions!.rootDir}"`)
  }

  if (tscfg.compilerOptions.noEmit !== true) {
    const setting = renderSetting('compilerOptions.noEmit')
    log.warn(
      `Please set ${setting} to true. This will ensure you do not accidentally emit using ${chalk.yellowBright(
        `\`$ tsc\``
      )}. Use ${chalk.yellowBright(`\`$ nexus build\``)} to build your app and emit JavaScript.`
    )
  }

  /**
   * Setup noEmit. Internally we always want emit to be on.
   */

  tscfg.compilerOptions.noEmit = false

  /**
   * Setup out root (aka. outDir)
   */

  if (input.overrides?.outRoot !== undefined) {
    tscfg.compilerOptions.outDir = input.overrides.outRoot
  } else if (!tscfg.compilerOptions.outDir) {
    tscfg.compilerOptions.outDir = DEFAULT_BUILD_DIR_PATH_RELATIVE_TO_PROJECT_ROOT
  }

  /**
   * Validate the tsconfig
   */

  const tsconfig = ts.parseJsonConfigFileContent(tscfg, ts.sys, projectRoot, undefined, tsconfigPath)

  checkNoTsConfigErrors(tsconfig)

  log.trace('finished read')

  return { content: tsconfig, path: tsconfigPath }
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
  const config: TsConfigJson = {
    compilerOptions: {
      target: 'es2016',
      module: 'commonjs',
      lib: ['esnext'],
      strict: true,
      rootDir: sourceRelative,
      noEmit: true,
      plugins: [{ name: 'nexus/typescript-language-service' }],
    },
    include: [sourceRelative],
  }
  return JSON.stringify(config, null, 2)
}

/**
 * Prettifier a property path for terminal output.
 */
function renderSetting(setting: string) {
  return chalk.yellowBright(`\`${setting}\``)
}
