import chalk from 'chalk'
import { stripIndent } from 'common-tags'
import { Either, left, right } from 'fp-ts/lib/Either'
import * as fs from 'fs-jetpack'
import { cloneDeep } from 'lodash'
import { EOL } from 'os'
import * as Path from 'path'
import { TsConfigJson } from 'type-fest'
import * as ts from 'typescript'
import { isDeepStrictEqual } from 'util'
import { rootLogger } from '../nexus-logger'
import { exception, exceptionType } from '../utils'
import { DEFAULT_BUILD_DIR_PATH_RELATIVE_TO_PROJECT_ROOT } from './build'

export const NEXUS_TS_LSP_IMPORT_ID = 'nexus/typescript-language-service'

const log = rootLogger.child('tsconfig')

const diagnosticHost: ts.FormatDiagnosticsHost = {
  getNewLine: () => ts.sys.newLine,
  getCurrentDirectory: () => process.cwd(),
  getCanonicalFileName: (path) => path,
}

/**
 * An error following the parsing of tsconfig. Kinds of errors include type validations like if include field is an array.
 */
const invalidTsConfig = exceptionType<'invalid_tsconfig', { diagnostics: ts.Diagnostic[] }>(
  'invalid_tsconfig',
  ({ diagnostics }) =>
    'Your tsconfig.json is invalid\n\n' + ts.formatDiagnosticsWithColorAndContext(diagnostics, diagnosticHost)
)

export async function readOrScaffoldTsconfig(input: {
  projectRoot: string
  overrides?: { outRoot?: string }
}): Promise<Either<Error, { content: ts.ParsedCommandLine; path: string }>> {
  log.trace('start read')
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
    return left(
      exception(
        'Unable to read your tsconifg.json\n\n' +
          ts.formatDiagnosticsWithColorAndContext([tscfgReadResult.error], diagnosticHost),
        {
          // todo leads to circ ref error in json serialize
          // diagnostics: [tscfgReadResult.error],
        }
      )
    )
  }

  const tsconfigSource: TsConfigJson = tscfgReadResult.config

  // setup zero values

  if (!tsconfigSource.compilerOptions) {
    tsconfigSource.compilerOptions = {}
  }

  if (!tsconfigSource.compilerOptions.plugins) {
    tsconfigSource.compilerOptions.plugins = []
  }

  if (!tsconfigSource.include) {
    tsconfigSource.include = []
  } else if (!Array.isArray(tsconfigSource.include)) {
    // If the include is present but not array it must mean a mal-formed tsconfig.
    // Exit early, if we contintue we will have a runtime error when we try .push on a non-array.
    // todo testme once we're not relying on mock process exit
    const diagnostics = ts.parseJsonConfigFileContent(
      tsconfigSource,
      ts.sys,
      projectRoot,
      undefined,
      tsconfigPath
    ).errors
    if (diagnostics.length > 0) {
      return left(invalidTsConfig({ diagnostics }))
    }
  }

  const tsconfigSourceOriginal = cloneDeep(tsconfigSource)
  let tsconfigParsed = ts.parseJsonConfigFileContent(
    tsconfigSourceOriginal,
    ts.sys,
    projectRoot,
    undefined,
    tsconfigPath
  )

  // Lint

  // plugins compiler option is not inheried by extends
  // thus we should not be working with parsed tsconfig here
  const plugins = tsconfigSource.compilerOptions.plugins

  if (plugins.length) {
    if (!plugins.map((p) => p.name).includes('nexus/typescript-language-service')) {
      // work with the local tsconfig for fix
      const pluginsFixed = tsconfigSource.compilerOptions.plugins.concat([{ name: NEXUS_TS_LSP_IMPORT_ID }])
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

  if (tsconfigParsed.options.tsBuildInfoFile) {
    delete tsconfigParsed.options.tsBuildInfoFile
    const setting = renderSetting(`compilerOptions.tsBuildInfoFile`)
    log.warn(`You have set ${setting} but it will be ignored by Nexus. Nexus manages this value internally.`)
  }

  if (tsconfigParsed.options.incremental) {
    delete tsconfigParsed.options.incremental
    const setting = renderSetting('compilerOptions.incremental')
    log.warn(`You have set ${setting} but it will be ignored by Nexus. Nexus manages this value internally.`)
  }

  const { types } = tsconfigParsed.options
  if (types) {
    delete tsconfigParsed.options.typeRoots
    delete tsconfigParsed.options.types
    const setting = renderSetting('compilerOptions.types')
    log.error(
      `You have set ${setting} but Nexus does not support it. If you do not remove your customization you may/will (e.g. VSCode) see inconsistent results between your IDE and what Nexus tells you at build time. If you would like to see Nexus support this setting please chime in at https://github.com/graphql-nexus/nexus/issues/1036.`
    )
  }

  /**
   * Setup typeRoots
   */

  const { typeRoots } = tsconfigSourceOriginal.compilerOptions!
  const nameAtTypes = 'node_modules/@types'
  const nameTypes = 'types'
  const explainAtTypes = `"${nameAtTypes}" is the TypeScript default for types packages and where Nexus outputs typegen to.`
  const explainTypes = `"${nameTypes}" is the Nexus convention for _local_ types packages.`
  if (!typeRoots) {
    const setting = renderSetting('compilerOptions.typeRoots')
    const val = renderVal([nameAtTypes, nameTypes])
    const explainsRendered = [explainAtTypes, explainTypes].join(' ')
    tsconfigSource.compilerOptions.typeRoots = [nameAtTypes, nameTypes]
    log.warn(`Please set ${setting} to ${val}. ${explainsRendered}`)
  } else {
    const vals: string[] = []
    let missingAtTypes = false
    let explainAtTypes = ''
    let explainTypes = ''
    let explains: string[] = []
    if (!typeRoots.includes(nameAtTypes)) {
      missingAtTypes = true
      explains.push(explainAtTypes)
      tsconfigSource.compilerOptions.typeRoots!.push(nameAtTypes)
      vals.push(nameAtTypes)
    }
    if (!typeRoots.includes(nameTypes)) {
      explains.push(explainTypes)
      tsconfigSource.compilerOptions.typeRoots!.push(nameTypes)
      vals.push(nameTypes)
    }
    if (vals.length) {
      const setting = renderSetting('compilerOptions.typeRoots')
      const valsRendered = vals.map(renderVal).join(', ')
      const explainsRendered = explains.join(' ')
      // If typeRoots are specified but node_modules/@types is not in them
      // that's really bad! So elevate log to error level.
      if (missingAtTypes) {
        log.error(`Please add ${valsRendered} to your ${setting} array. ${explainsRendered}`)
      } else {
        log.warn(`Please add ${valsRendered} to your ${setting} array. ${explainsRendered}`)
      }
    }
  }

  /**
   * Setup types declaration file support.
   * Work with local tsconfig source contents as the Nexus convention is
   * supporting a types.d.ts file at project root and "include" is relative to
   * the tsconfig it shows up in. Thus We want to lint for local config
   * presence, not inherited.
   */

  if (!tsconfigSourceOriginal.include?.includes('types.d.ts')) {
    tsconfigSource.include.push('types.d.ts')
    const val = renderVal('types.d.ts')
    const setting = renderVal('include')
    log.warn(
      `Please add ${val} to your ${setting} array. If you do not then results from Nexus and your IDE will not agree if the declaration file is used in your project.`
    )
  }

  /**
   * Setup source root (aka. rootDir)
   */

  // Do not edit paths of tsconfig parsed
  // Doing so is dangerous because the input in tsconfig source is processed by parsing
  // To edit tsconfig parsed directly would be to know/redo that parsing, which we don't

  if (!tsconfigSource.compilerOptions.rootDir) {
    tsconfigSource.compilerOptions.rootDir = '.'
    const setting = renderSetting('compilerOptions.rootDir')
    const val = renderVal(tsconfigSource.compilerOptions.rootDir)
    log.warn(`Please set ${setting} to ${val}`)
  }

  if (!tsconfigSource.include.includes(tsconfigSource.compilerOptions.rootDir!)) {
    tsconfigSource.include.push(tsconfigSource.compilerOptions.rootDir!)
    const setting = renderSetting('include')
    log.warn(`Please set ${setting} to have "${tsconfigSource.compilerOptions.rootDir}"`)
  }

  /**
   * Handle noEmit
   * Users should also set to true
   * But inernally we enable
   */

  if (tsconfigParsed.options.noEmit !== true) {
    const setting = renderSetting('compilerOptions.noEmit')
    log.warn(
      `Please set ${setting} to true. This will ensure you do not accidentally emit using ${chalk.yellowBright(
        `\`$ tsc\``
      )}. Use ${chalk.yellowBright(`\`$ nexus build\``)} to build your app and emit JavaScript.`
    )
  }

  if (tsconfigParsed.options.esModuleInterop !== true) {
    tsconfigParsed.options.esModuleInterop = true
    const setting = renderSetting('compilerOptions.esModuleInterop')
    log.warn(
      `Please set ${setting} to true. This will ensure that some libraries that Nexus uses will properly be transpiled to Javascript.`
    )
  }

  /**
   * Setup out root (aka. outDir)
   */

  // todo what's the point of letting users modify this?
  // Just that if they disable bundle they need an output path?
  if (input.overrides?.outRoot !== undefined) {
    tsconfigParsed.options.outDir = input.overrides.outRoot
  } else if (!tsconfigParsed.options.outDir) {
    tsconfigParsed.options.outDir = DEFAULT_BUILD_DIR_PATH_RELATIVE_TO_PROJECT_ROOT
  }

  /**
   * Rebuild the parsed tsconfig if it changed
   * For example if we adjusted include or rootDir we need those paths to be expanded.
   */

  if (!isDeepStrictEqual(tsconfigSource, tsconfigSourceOriginal)) {
    tsconfigParsed = ts.parseJsonConfigFileContent(
      tsconfigSource,
      ts.sys,
      projectRoot,
      undefined,
      tsconfigPath
    )
  }

  /**
   * Forced internal settings
   */

  tsconfigParsed.options.noEmit = false

  /**
   * Validate the tsconfig
   */

  if (tsconfigParsed.errors.length > 0) {
    return left(invalidTsConfig({ diagnostics: tsconfigParsed.errors }))
  }

  log.trace('finished read')

  return right({ content: tsconfigParsed, path: tsconfigPath })
}

/**
 * Create tsconfig source contents, optimized for Nexus
 */
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
      typeRoots: ['node_modules/@types', 'types'],
      esModuleInterop: true
    },
    include: ['types.d.ts', sourceRelative],
  }
  return JSON.stringify(config, null, 2)
}

/**
 * Prettify a property path for terminal output.
 */
function renderSetting(setting: string) {
  return chalk.yellowBright(`\`${setting}\``)
}

/**
 * Prettify a JSON value for terminal output.
 */
function renderVal(val: unknown): string {
  return chalk.yellowBright(JSON.stringify(val))
}
