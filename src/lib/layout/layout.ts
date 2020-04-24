import Chalk from 'chalk'
import { stripIndent } from 'common-tags'
import * as FS from 'fs-jetpack'
import * as Path from 'path'
import { PackageJson } from 'type-fest'
import { ParsedCommandLine } from 'typescript'
import { findFile, findFileRecurisvelyUpwardSync } from '../../lib/fs'
import { START_MODULE_NAME } from '../../runtime/start/start-module'
import { rootLogger } from '../nexus-logger'
import * as PackageManager from '../package-manager'
import { fatal } from '../process'
import * as Schema from './schema-modules'
import { readOrScaffoldTsconfig } from './tsconfig'

export const DEFAULT_BUILD_FOLDER_PATH_RELATIVE_TO_PROJECT_ROOT = 'node_modules/.build'

const log = rootLogger.child('layout')

/**
 * The part of layout data resulting from the dynamic file/folder inspection.
 */
export type ScanResult = {
  // build: {
  //   dir: string
  // }
  // source: {
  //   isNested: string
  // }
  app:
    | {
        exists: true
        path: string
      }
    | {
        exists: false
        path: null
      }
  project: {
    name: string
    isAnonymous: boolean
  }
  sourceRoot: string
  projectRoot: string
  schemaModules: string[]
  tsConfig: {
    content: ParsedCommandLine
    path: string
  }
  packageManagerType: PackageManager.PackageManager['type']
  packageJson: null | {
    dir: string
    path: string
    content: PackageJson
  }
  // schema:
  //   | {
  //       exists: boolean
  //       multiple: true
  //       paths: string[]
  //     }
  //   | {
  //       exists: boolean
  //       multiple: false
  //       path: null | string
  //     }
  // context: {
  //   exists: boolean
  //   path: null | string
  // }
}

/**
 * The combination of manual datums the user can specify about the layout plus
 * the dynamic scan results.
 */
export type Data = ScanResult & {
  buildOutput: string
  startModuleOutPath: string
  startModuleInPath: string
}

/**
 * Layout represents the important edges of the project to support things like
 * scaffolding, build, and dev against the correct paths.
 */
export type Layout = Data & {
  /**
   * Property that aliases all the and only the data properties, makes it
   * easy to e.g. serialize just the data.
   */
  data: Data
  projectRelative(filePath: string): string
  projectPath(...subPaths: string[]): string
  sourceRelative(filePath: string): string
  sourcePath(...subPaths: string[]): string
  packageManager: PackageManager.PackageManager
}

interface Options {
  /**
   * The place to output the build, relative to project root.
   */
  buildOutput?: string
  entrypointPath?: string
  cwd?: string
}

const optionDefaults = {
  buildOutput: DEFAULT_BUILD_FOLDER_PATH_RELATIVE_TO_PROJECT_ROOT,
}

/**
 * Perform a layout scan and return results with attached helper functions.
 */
export async function create(options?: Options): Promise<Layout> {
  const cwd = options?.cwd ?? process.cwd()
  const normalizedEntrypoint = normalizeEntrypoint(options?.entrypointPath, cwd)
  // TODO lodash merge defaults or something

  const scanResult = await scan({ cwd, entrypointPath: normalizedEntrypoint })
  const buildOutput = getBuildOutput(options?.buildOutput, scanResult)
  const outputInfo = {
    buildOutput,
    startModuleInPath: Path.join(scanResult.sourceRoot, START_MODULE_NAME + '.ts'),
    startModuleOutPath: Path.join(buildOutput, START_MODULE_NAME + '.js'),
  }

  log.trace('additional layout data', { data: outputInfo })

  const layout = createFromData({
    ...scanResult,
    ...outputInfo,
  })

  /**
   * Save the created layout in the env
   */
  process.env = {
    ...process.env,
    ...saveDataForChildProcess(layout),
  }

  return layout
}

/**
 * Create a layout based on received data. Useful for taking in serialized scan
 * data from another process that would be wasteful to re-calculate.
 */
export function createFromData(layoutData: Data): Layout {
  return {
    ...layoutData,
    data: layoutData,
    projectRelative: Path.relative.bind(null, layoutData.projectRoot),
    sourceRelative: Path.relative.bind(null, layoutData.sourceRoot),
    sourcePath(...subPaths: string[]): string {
      return Path.join(layoutData.sourceRoot, ...subPaths)
    },
    projectPath(...subPaths: string[]): string {
      return Path.join(layoutData.projectRoot, ...subPaths)
    },
    packageManager: PackageManager.createPackageManager(layoutData.packageManagerType, {
      projectRoot: layoutData.projectRoot,
    }),
  }
}

/**
 * Analyze the user's project files/folders for how conventions are being used
 * and where key modules exist.
 */
export async function scan(opts?: { cwd?: string; entrypointPath?: string }): Promise<ScanResult> {
  log.trace('starting scan')
  const projectRoot = opts?.cwd ?? process.cwd()
  const packageManagerType = await PackageManager.detectProjectPackageManager({ projectRoot })
  const maybePackageJson = findPackageJson({ projectRoot })
  const maybeAppModule = opts?.entrypointPath ?? findAppModule({ projectRoot })
  let maybeSchemaModules = Schema.findDirOrModules({ projectRoot })
  const tsConfig = await readOrScaffoldTsconfig({
    projectRoot,
  })

  // Remove entrypoint from schema modules (can happen if the entrypoint is named graphql.ts or inside a graphql/ folder)
  if (maybeSchemaModules && maybeAppModule && maybeSchemaModules.includes(maybeAppModule)) {
    maybeSchemaModules = maybeSchemaModules.filter((s) => s !== maybeAppModule)
  }

  const result: ScanResult = {
    app:
      maybeAppModule === null
        ? ({ exists: false, path: maybeAppModule } as const)
        : ({ exists: true, path: maybeAppModule } as const),
    projectRoot,
    sourceRoot: tsConfig.content.options.rootDir!,
    schemaModules: maybeSchemaModules,
    project: readProjectInfo(opts),
    tsConfig,
    packageManagerType,
    packageJson: maybePackageJson,
  }

  if (result.app.exists === false && result.schemaModules.length === 0) {
    log.error(checks.no_app_or_schema_modules.explanations.problem)
    log.error(checks.no_app_or_schema_modules.explanations.solution)
    process.exit(1)
  }

  log.trace('completed scan', { result })

  return result
}

// todo allow user to configure these for their project
const CONVENTIONAL_ENTRYPOINT_MODULE_NAME = 'app'
const CONVENTIONAL_ENTRYPOINT_FILE_NAME = `${CONVENTIONAL_ENTRYPOINT_MODULE_NAME}.ts`

const checks = {
  no_app_or_schema_modules: {
    code: 'no_app_or_schema_modules',
    // prettier-ignore
    explanations: {
      problem: `We could not find any ${Schema.MODULE_NAME} modules or app entrypoint`,
      solution: stripIndent`
        Please do one of the following:

          1. Create a (${Chalk.yellow(Schema.CONVENTIONAL_SCHEMA_FILE_NAME)} file and write your GraphQL type definitions in it.
          2. Create a ${Chalk.yellow(Schema.DIR_NAME)} directory and write your GraphQL type definitions inside files there.
          3. Create an ${Chalk.yellow(CONVENTIONAL_ENTRYPOINT_FILE_NAME)} file.
    `,
    }
  },
}

/**
 * Find the (optional) app module in the user's project.
 */
export function findAppModule(opts: { projectRoot: string }): string | null {
  log.trace('looking for app module')
  const path = findFile(CONVENTIONAL_ENTRYPOINT_FILE_NAME, opts)
  log.trace('done looking for app module', { path })

  return path
}

/**
 * Find the project root directory. This can be different than the source root
 * directory. For example the classic project structure where there is a root
 * `src` folder. `src` folder would be considered the "source root".
 *
 * Project root is considered to be the first package.json found from cwd upward
 * to disk root. If not package.json is found then cwd is taken to be the
 * project root.
 *
 * todo update jsdoc or make it true again
 *
 */
export function findProjectDir(): string {
  return process.cwd()
}

/**
 * Detect whether or not CWD is inside a nexus project. nexus project is
 * defined as there being a package.json in or above CWD with nexus as a
 * direct dependency.
 */
export async function scanProjectType(opts: {
  cwd: string
}): Promise<
  | { type: 'unknown' | 'new' }
  | {
      type: 'NEXUS_project' | 'node_project'
      packageJson: {}
      packageJsonLocation: { path: string; dir: string }
    }
> {
  const packageJsonLocation = findPackageJsonRecursivelyUpward(opts)

  if (packageJsonLocation === null) {
    if (await isEmptyCWD()) {
      return { type: 'new' }
    }
    return { type: 'unknown' }
  }

  const packageJson = FS.read(packageJsonLocation.path, 'json')
  if (packageJson?.dependencies?.['nexus']) {
    return {
      type: 'NEXUS_project',
      packageJson: packageJsonLocation,
      packageJsonLocation: packageJsonLocation,
    }
  }

  return {
    type: 'node_project',
    packageJson: packageJsonLocation,
    packageJsonLocation: packageJsonLocation,
  }
}

/**
 * Check if the CWD is empty of any files or folders.
 * TODO we should make nice exceptions for known meaningless files, like .DS_Store
 */
async function isEmptyCWD(): Promise<boolean> {
  const contents = await FS.listAsync()
  return contents === undefined || contents.length === 0
}

const ENV_VAR_DATA_NAME = 'NEXUS_LAYOUT'

export function saveDataForChildProcess(layout: Layout): { NEXUS_LAYOUT: string } {
  return {
    [ENV_VAR_DATA_NAME]: JSON.stringify(layout.data),
  }
}

/**
 * Load the layout data from a serialized version stored in the environment. If
 * it is not found then a warning will be logged and it will be recalculated.
 * For this reason the function is async however under normal circumstances it
 * should be as-if sync.
 */
export async function loadDataFromParentProcess(): Promise<Layout> {
  const savedData: undefined | string = process.env[ENV_VAR_DATA_NAME]
  if (!savedData) {
    log.trace(
      'WARNING an attempt to load saved layout data was made but no serialized data was found in the environment. This may represent a bug. Layout is being re-calculated as a fallback solution. This should result in the same layout data (if not, another probably bug, compounding confusion) but at least adds latentency to user experience.'
    )
    return create({}) // todo no build output...
  } else {
    return createFromData(JSON.parse(savedData) as Data)
  }
}

export function mustLoadDataFromParentProcess(): Layout {
  const savedData: undefined | string = process.env[ENV_VAR_DATA_NAME]
  if (!savedData) {
    throw new Error(
      'An attempt to load saved layout data was made but no serialized data was found in the environment'
    )
  }
  return createFromData(JSON.parse(savedData) as Data)
}

function readProjectInfo(opts?: { cwd?: string }): ScanResult['project'] {
  const localFS = FS.cwd(opts?.cwd ?? process.cwd())
  try {
    const packageJson: PackageJson = require(localFS.path('package.json'))

    if (packageJson.name) {
      return {
        name: packageJson.name,
        isAnonymous: false,
      }
    }
  } catch {}

  return {
    name: 'anonymous',
    isAnonymous: true,
  }
}

/**
 * Find the package.json file path. Looks recursively upward to disk root.
 * Starts looking in CWD If no package.json found along search, returns null.
 */
function findPackageJsonRecursivelyUpward(opts: { cwd: string }) {
  return findFileRecurisvelyUpwardSync('package.json', opts)
}

/**
 *
 */
function findPackageJson(opts: { projectRoot: string }): ScanResult['packageJson'] {
  const packageJsonPath = FS.path(opts.projectRoot, 'package.json')

  try {
    const content = FS.read(packageJsonPath, 'json')

    return {
      content,
      path: packageJsonPath,
      dir: Path.dirname(packageJsonPath),
    }
  } catch {
    return null
  }
}

function normalizeEntrypoint(entrypoint: string | undefined, cwd: string): string | undefined {
  if (!entrypoint) {
    return undefined
  }

  const absoluteEntrypoint = entrypoint.startsWith('/') ? entrypoint : Path.join(cwd, entrypoint)

  if (!absoluteEntrypoint.endsWith('.ts')) {
    fatal('Entrypoint must be a .ts file', { path: absoluteEntrypoint })
  }

  if (!FS.exists(absoluteEntrypoint)) {
    fatal('Entrypoint does not exist', { path: absoluteEntrypoint })
  }

  return absoluteEntrypoint
}

/**
 * Get the relative output build path
 * Precedence: User's input > tsconfig.json's outDir > default
 */
function getBuildOutput(buildOutput: string | undefined, scanResult: ScanResult): string {
  const output = buildOutput ?? scanResult.tsConfig.content.options.outDir ?? optionDefaults.buildOutput

  if (Path.isAbsolute(output)) {
    return output
  }

  return Path.join(scanResult.projectRoot, output)
}
