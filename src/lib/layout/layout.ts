import { rightOrThrow } from '@nexus/logger/dist/utils'
import Chalk from 'chalk'
import { stripIndent } from 'common-tags'
import { Either, isLeft, left, right } from 'fp-ts/lib/Either'
import * as FS from 'fs-jetpack'
import * as Path from 'path'
import * as ts from 'ts-morph'
import { PackageJson } from 'type-fest'
import type { ParsedCommandLine } from 'typescript'
import { findFile, isEmptyDir } from '../../lib/fs'
import { START_MODULE_NAME } from '../../runtime/start/start-module'
import { rewordError } from '../contextual-error'
import { rootLogger } from '../nexus-logger'
import * as PJ from '../package-json'
import * as PackageManager from '../package-manager'
import { createContextualError } from '../utils'
import { readOrScaffoldTsconfig } from './tsconfig'

export const DEFAULT_BUILD_FOLDER_PATH_RELATIVE_TO_PROJECT_ROOT = '.nexus/build'
/**
 * The temporary ts build folder used when bundling is enabled
 *
 * Note: It **should not** be nested in a sub-folder. This might "corrupt" the relative paths of the bundle build.
 */
export const TMP_TS_BUILD_FOLDER_PATH_RELATIVE_TO_PROJECT_ROOT = '.tmp_build'

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
  nexusModules: string[]
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

type OutputInfo = {
  startModuleOutPath: string
  startModuleInPath: string
  tsOutputDir: string
  bundleOutputDir: string | null
  /**
   * The final path to the start module. When bundling disbaled, same as `startModuleOutPath`.
   */
  startModule: string
  /**
   * The final output dir. If bundler is enabled then this is `bundleOutputDir`.
   * Otherwise it is `tsOutputDir`.
   *
   * When bundle case, this accounts for the bundle environment, which makes it
   * **DIFFERENT** than the source root. For example:
   *
   * ```
   * <out_root>/node_modules/
   * <out_root>/api/app.ts
   * <out_root>/api/index.ts
   * ```
   */
  root: string
  /**
   * If bundler is enabled then the final output dir where the **source** is
   * located. Otherwise same as `tsOutputDir`.
   *
   * When bundle case, this is different than `root` because it tells you where
   * the source starts, not the build environment.
   *
   * For example, here `source_root` is `<out_root>/api` becuase the user has
   * set their root dir to `api`:
   *
   * ```
   * <out_root>/node_modules/
   * <out_root>/api/app.ts
   * <out_root>/api/index.ts
   * ```
   *
   * But here, `source_root` is `<out_root>` because the user has set their root
   * dir to `.`:
   *
   * ```
   * <out_source_root>/node_modules/
   * <out_source_root>/app.ts
   * <out_source_root>/index.ts
   * ```
   */
  sourceRoot: string
}

/**
 * The combination of manual datums the user can specify about the layout plus
 * the dynamic scan results.
 */
export type Data = ScanResult & { build: OutputInfo }

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
  /**
   * Like projectPath but treats absolute paths as passthrough.
   */
  projectPathOrAbsolute(...subPaths: string[]): string
  sourceRelative(filePath: string): string
  sourcePath(...subPaths: string[]): string
  update(options: UpdateableLayoutData): void
  packageManager: PackageManager.PackageManager
}

interface UpdateableLayoutData {
  nexusModules?: string[]
}

interface Options {
  /**
   * The place to output the build, relative to project root.
   */
  buildOutputDir?: string
  /**
   * Path to the nexus entrypoint. Can be absolute or relative.
   */
  entrypointPath?: string
  /**
   * Directory in which the layout should be performed
   */
  cwd?: string
  /**
   * Whether the build should be outputted as a bundle
   */
  asBundle?: boolean
}

const optionDefaults = {
  buildOutput: DEFAULT_BUILD_FOLDER_PATH_RELATIVE_TO_PROJECT_ROOT,
}

/**
 * Perform a layout scan and return results with attached helper functions.
 */
export async function create(options?: Options): Promise<Either<Error, Layout>> {
  const cwd = options?.cwd ?? process.cwd()
  const errNormalizedEntrypoint = normalizeEntrypoint(options?.entrypointPath, cwd)

  if (isLeft(errNormalizedEntrypoint)) return errNormalizedEntrypoint
  const normalizedEntrypoint = errNormalizedEntrypoint.right

  // TODO lodash merge defaults or something

  const errScanResult = await scan({ cwd, entrypointPath: normalizedEntrypoint })
  if (isLeft(errScanResult)) return errScanResult
  const scanResult = errScanResult.right

  const buildInfo = getBuildInfo(options?.buildOutputDir, scanResult, options?.asBundle)

  log.trace('layout build info', { data: buildInfo })

  const layout = createFromData({
    ...scanResult,
    build: buildInfo,
  })

  /**
   * Save the created layout in the env
   */
  process.env = {
    ...process.env,
    ...saveDataForChildProcess(layout),
  }

  return right(layout)
}

/**
 * Create a layout based on received data. Useful for taking in serialized scan
 * data from another process that would be wasteful to re-calculate.
 */
export function createFromData(layoutData: Data): Layout {
  let layout: Layout = {
    ...layoutData,
    data: layoutData,
    projectRelative: Path.relative.bind(null, layoutData.projectRoot),
    sourceRelative: Path.relative.bind(null, layoutData.sourceRoot),
    sourcePath(...subPaths: string[]): string {
      return Path.join(layoutData.sourceRoot, ...subPaths)
    },
    projectPath(...subPaths: string[]): string {
      const joinedPath = Path.join(...subPaths)
      return Path.join(layoutData.projectRoot, joinedPath)
    },
    projectPathOrAbsolute(...subPaths: string[]): string {
      const joinedPath = Path.join(...subPaths)
      if (Path.isAbsolute(joinedPath)) return joinedPath
      return Path.join(layoutData.projectRoot, joinedPath)
    },
    packageManager: PackageManager.createPackageManager(layoutData.packageManagerType, {
      projectRoot: layoutData.projectRoot,
    }),
    update(options) {
      if (options.nexusModules) {
        layout.nexusModules = options.nexusModules
        layout.data.nexusModules = options.nexusModules
      }
    },
  }

  return layout
}

/**
 * Analyze the user's project files/folders for how conventions are being used
 * and where key modules exist.
 */
export async function scan(opts?: {
  cwd?: string
  entrypointPath?: string
}): Promise<Either<Error, ScanResult>> {
  log.trace('starting scan')
  const projectRoot = opts?.cwd ?? process.cwd()
  const packageManagerType = await PackageManager.detectProjectPackageManager({ projectRoot })
  const maybeErrPackageJson = PJ.findRecurisvelyUpwardSync({ cwd: projectRoot })
  const maybeAppModule = opts?.entrypointPath ?? findAppModule({ projectRoot })
  const tsConfig = await readOrScaffoldTsconfig({
    projectRoot,
  })
  const nexusModules = findNexusModules(tsConfig, maybeAppModule)

  if (maybeErrPackageJson && isLeft(maybeErrPackageJson.contents)) {
    return maybeErrPackageJson.contents
  }

  const result: ScanResult = {
    app:
      maybeAppModule === null
        ? ({ exists: false, path: maybeAppModule } as const)
        : ({ exists: true, path: maybeAppModule } as const),
    projectRoot,
    sourceRoot: tsConfig.content.options.rootDir!,
    nexusModules,
    project: readProjectInfo(opts),
    tsConfig,
    packageManagerType,
    packageJson: maybeErrPackageJson
      ? { ...maybeErrPackageJson, content: rightOrThrow(maybeErrPackageJson.contents) }
      : maybeErrPackageJson,
  }

  log.trace('completed scan', { result })

  if (result.app.exists === false && result.nexusModules.length === 0) {
    log.error(checks.no_app_or_schema_modules.explanations.problem)
    log.error(checks.no_app_or_schema_modules.explanations.solution)
    process.exit(1)
  }

  return right(result)
}

// todo allow user to configure these for their project
const CONVENTIONAL_ENTRYPOINT_MODULE_NAME = 'app'
const CONVENTIONAL_ENTRYPOINT_FILE_NAME = `${CONVENTIONAL_ENTRYPOINT_MODULE_NAME}.ts`

const checks = {
  no_app_or_schema_modules: {
    code: 'no_app_or_schema_modules',
    // prettier-ignore
    explanations: {
      problem: `We could not find any modules that imports 'nexus' or ${CONVENTIONAL_ENTRYPOINT_FILE_NAME} entrypoint`,
      solution: stripIndent`
        Please do one of the following:

          1. Create a file, import { schema } from 'nexus' and write your GraphQL type definitions in it.
          2. Create an ${Chalk.yellow(CONVENTIONAL_ENTRYPOINT_FILE_NAME)} file.
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
  | { type: 'malformed_package_json'; error: PJ.MalformedPackageJsonError }
  | {
      type: 'NEXUS_project' | 'node_project'
      packageJson: {}
      packageJsonLocation: { path: string; dir: string }
    }
> {
  const packageJson = PJ.findRecurisvelyUpwardSync(opts)

  if (packageJson === null) {
    if (await isEmptyDir(opts.cwd)) {
      return { type: 'new' }
    }
    return { type: 'unknown' }
  }

  if (isLeft(packageJson.contents)) {
    const e = packageJson.contents.left
    return {
      type: 'malformed_package_json',
      error: rewordError(`A package.json was found at ${e.context.path} but it was malformed`, e),
    }
  }

  const pjc = rightOrThrow(packageJson.contents) // will never throw, check above
  if (pjc.dependencies?.['nexus']) {
    return {
      type: 'NEXUS_project',
      packageJson: packageJson,
      packageJsonLocation: packageJson,
    }
  }

  return {
    type: 'node_project',
    packageJson: packageJson,
    packageJsonLocation: packageJson,
  }
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
export async function loadDataFromParentProcess(): Promise<Either<Error, Layout>> {
  const savedData: undefined | string = process.env[ENV_VAR_DATA_NAME]
  if (!savedData) {
    log.trace(
      'WARNING an attempt to load saved layout data was made but no serialized data was found in the environment. This may represent a bug. Layout is being re-calculated as a fallback solution. This should result in the same layout data (if not, another probably bug, compounding confusion) but at least adds latentency to user experience.'
    )
    return create({}) // todo no build output...
  } else {
    // todo guard against corrupted env data
    return right(createFromData(JSON.parse(savedData) as Data))
  }
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

function normalizeEntrypoint(entrypoint: string | undefined, cwd: string): Either<Error, string | undefined> {
  if (!entrypoint) {
    return right(undefined)
  }

  const absoluteEntrypoint = entrypoint.startsWith('/') ? entrypoint : Path.join(cwd, entrypoint)

  if (!absoluteEntrypoint.endsWith('.ts')) {
    const error = createContextualError('Entrypoint must be a .ts file', { path: absoluteEntrypoint })
    return left(error)
  }

  if (!FS.exists(absoluteEntrypoint)) {
    const error = createContextualError('Entrypoint does not exist', { path: absoluteEntrypoint })
    return left(error)
  }

  return right(absoluteEntrypoint)
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

export function findNexusModules(tsConfig: ScanResult['tsConfig'], maybeAppModule: string | null): string[] {
  try {
    log.trace('finding nexus modules')
    const project = new ts.Project({
      addFilesFromTsConfig: false, // Prevent ts-morph from re-parsing the tsconfig
    })

    tsConfig.content.fileNames.forEach((f) => project.addSourceFileAtPath(f))

    const modules = project
      .getSourceFiles()
      .filter((s) => {
        // Do not add app module to nexus modules
        if (s.getFilePath().toString() === maybeAppModule) {
          return false
        }

        return s.getImportDeclaration('nexus') !== undefined
      })
      .map((s) => s.getFilePath().toString())

    log.trace('done finding nexus modules', { modules })

    return modules
  } catch (error) {
    log.error('We could not find your nexus modules', { error })
    return []
  }
}

function getBuildInfo(
  buildOutput: string | undefined,
  scanResult: ScanResult,
  asBundle?: boolean
): OutputInfo {
  const tsOutputDir = getBuildOutput(buildOutput, scanResult)
  const startModuleInPath = Path.join(scanResult.sourceRoot, START_MODULE_NAME + '.ts')
  const startModuleOutPath = Path.join(tsOutputDir, START_MODULE_NAME + '.js')

  if (!asBundle) {
    return {
      tsOutputDir,
      startModuleInPath,
      startModuleOutPath,
      bundleOutputDir: null,
      startModule: startModuleOutPath,
      root: tsOutputDir,
      sourceRoot: tsOutputDir,
    }
  }

  const tsBuildInfo = getBuildInfo(TMP_TS_BUILD_FOLDER_PATH_RELATIVE_TO_PROJECT_ROOT, scanResult, false)
  const relativeRootDir = Path.relative(scanResult.projectRoot, scanResult.tsConfig.content.options.rootDir!)
  const sourceRoot = Path.join(tsOutputDir, relativeRootDir)

  return {
    ...tsBuildInfo,
    bundleOutputDir: tsOutputDir,
    root: tsOutputDir,
    startModule: Path.join(sourceRoot, START_MODULE_NAME + '.js'),
    sourceRoot,
  }
}
