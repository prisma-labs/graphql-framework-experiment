import * as fs from 'fs-jetpack'
import * as Path from 'path'
import { PackageJson } from 'type-fest'
import { findConfigFile, findFile, stripExt } from '../utils'
import { rootLogger } from '../utils/logger'
import * as PackageManager from '../utils/package-manager'
import * as Schema from './schema'

export const DEFAULT_BUILD_FOLDER_NAME = 'node_modules/.build'

const logger = rootLogger.child('layout')

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
  sourceRootRelative: string
  projectRoot: string
  schemaModules: string[]
  packageManagerType: PackageManager.PackageManager['type']
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
  sourceRelative(filePath: string): string
  sourcePath(subPath: string): string
  packageManager: PackageManager.PackageManager
}

type Options = {
  buildOutput?: string
}

const optionDefaults = {
  buildOutput: DEFAULT_BUILD_FOLDER_NAME,
}

/**
 * Perform a layout scan and return results with attached helper functions.
 */
export async function create(optionsGiven?: Options): Promise<Layout> {
  // TODO lodash merge defaults or something
  const options: Required<Options> = {
    buildOutput: optionsGiven?.buildOutput ?? optionDefaults.buildOutput,
  }
  const data = await scan()
  return createFromData({ ...data, buildOutput: options.buildOutput })
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
    sourcePath(subpath: string): string {
      return Path.join(layoutData.sourceRoot, subpath)
    },
    packageManager: PackageManager.create(layoutData.packageManagerType),
  }
}

/**
 * Analyze the user's project files/folders for how conventions are being used
 * and where key modules exist.
 */
export const scan = async (): Promise<ScanResult> => {
  logger.trace('starting scan...')
  const packageManagerType = await PackageManager.detectProjectPackageManager()
  const maybeAppModule = await findAppModule()
  const maybeSchemaModules = Schema.findDirOrModules()

  // TODO do not assume app module is at source root?
  let sourceRoot: string
  if (maybeAppModule) {
    sourceRoot = Path.dirname(maybeAppModule)
  } else {
    if (maybeSchemaModules.length !== 0) {
      // TODO This assumes first member is shallowest, true?
      sourceRoot = Path.dirname(maybeSchemaModules[0])
    } else {
      sourceRoot = process.cwd()
    }
  }

  const projectRoot = findProjectDir()

  const result: ScanResult = {
    app:
      maybeAppModule === null
        ? ({ exists: false, path: maybeAppModule } as const)
        : ({ exists: true, path: maybeAppModule } as const),
    projectRoot,
    sourceRoot,
    schemaModules: maybeSchemaModules,
    // when source and project roots are the same relative is computed as '' but
    // this is not valid path like syntax in a lot cases at least such as
    // tsconfig include field.
    sourceRootRelative: Path.relative(projectRoot, sourceRoot) || './',
    project: readProjectInfo(),
    packageManagerType,
  }

  if (result.app.exists === false && result.schemaModules.length === 0) {
    logger.error(
      'We could not find any schema modules or entrypoint for your app'
    )
    logger.error(
      'Please, either create a `schema.ts` file or `schema/` directory'
    )
    process.exit(1)
  }

  logger.trace('...completed scan', { result })

  return result
}

/**
 * Find the (optional) app module in the user's project.
 */
export const findAppModule = async () => {
  return findFile(['app.ts', 'server.ts', 'service.ts'])
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
 */
export function findProjectDir(): string {
  let packageJsonPath = findPackageJsonPath()

  if (packageJsonPath) {
    return Path.dirname(packageJsonPath)
  }

  return process.cwd()
}

/**
 * Build up what the import path will be for a module in its transpiled context.
 */
export function relativeTranspiledImportPath(
  layout: Layout,
  modulePath: string
): string {
  return './' + stripExt(calcSourceRootToModule(layout, modulePath))
}

function calcSourceRootToModule(layout: Layout, modulePath: string) {
  return Path.relative(layout.sourceRoot, modulePath)
}

/**
 * Find the package.json file path. Looks recursively upward to disk root. If no
 * package.json found along search, returns null.
 */
function findPackageJsonPath(): string | null {
  return findConfigFile('package.json', { required: false })
}

/**
 * Detect whether or not CWD is inside a nexus project. nexus project is
 * defined as there being a package.json in or above CWD with nexus as a
 * direct dependency.
 */
export async function scanProjectType(): Promise<
  | { type: 'unknown' | 'new' }
  | {
      type: 'NEXUS_project' | 'node_project'
      packageJson: {}
      packageJsonPath: string
    }
> {
  const packageJsonPath = findPackageJsonPath()

  if (packageJsonPath === null) {
    if (await isEmptyCWD()) {
      return { type: 'new' }
    }
    return { type: 'unknown' }
  }

  const packageJson = fs.read(packageJsonPath, 'json')
  if (packageJson?.dependencies?.['nexus']) {
    return { type: 'NEXUS_project', packageJson, packageJsonPath }
  }

  return { type: 'node_project', packageJson, packageJsonPath }
}

/**
 * Check if the CWD is empty of any files or folders.
 * TODO we should make nice exceptions for known meaningless files, like .DS_Store
 */
async function isEmptyCWD(): Promise<boolean> {
  const contents = await fs.listAsync()
  return contents === undefined || contents.length === 0
}

const ENV_VAR_DATA_NAME = 'NEXUS_LAYOUT'

export function saveDataForChildProcess(
  layout: Layout
): { NEXUS_LAYOUT: string } {
  return {
    [ENV_VAR_DATA_NAME]: JSON.stringify(layout.data),
  }
}

export async function loadDataFromParentProcess(): Promise<Layout> {
  const savedData: undefined | string = process.env[ENV_VAR_DATA_NAME]
  if (!savedData) {
    logger.trace(
      'WARNING an attempt to load saved layout data was made but no serialized data was found in the environment. This may represent a bug. Layout is being re-calculated as a fallback solution. This should result in the same layout data (if not, another probably bug, compounding confusion) but at least adds latentency to user experience.'
    )
    return create({}) // todo no build output...
  } else {
    return createFromData(JSON.parse(savedData) as Data)
  }
}

function readProjectInfo(): ScanResult['project'] {
  try {
    const packageJson: PackageJson = require(fs.path('package.json'))

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
