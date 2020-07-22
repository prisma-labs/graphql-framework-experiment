import { rightOrThrow } from '@nexus/logger/dist/utils'
import Chalk from 'chalk'
import { stripIndent } from 'common-tags'
import { Either, isLeft, left, right } from 'fp-ts/lib/Either'
import * as FS from 'fs-jetpack'
import * as OS from 'os'
import * as Path from 'path'
import * as tsm from 'ts-morph'
import type { ParsedCommandLine } from 'typescript'
import { findFile, isEmptyDir } from '../../lib/fs'
import { rootLogger } from '../nexus-logger'
import * as PJ from '../package-json'
import * as PackageManager from '../package-manager'
import { exception, exceptionType } from '../utils'
import { BuildLayout, getBuildLayout } from './build'
import { saveDataForChildProcess } from './cache'
import { readOrScaffoldTsconfig } from './tsconfig'

const log = rootLogger.child('layout')

// todo allow user to configure these for their project
const CONVENTIONAL_ENTRYPOINT_MODULE_NAME = 'app'
const CONVENTIONAL_ENTRYPOINT_FILE_NAME = `${CONVENTIONAL_ENTRYPOINT_MODULE_NAME}.ts`

/**
 * The part of layout data resulting from the dynamic file/folder inspection.
 */
export type ScanResult = {
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
}

/**
 * The combination of manual datums the user can specify about the layout plus
 * the dynamic scan results.
 */
export type Data = ScanResult & {
  build: BuildLayout
  packageJson: null | {
    dir: string
    path: string
    content: PJ.ValidPackageJson
  }
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
   * Force the project root directory. Defaults to being detected automatically.
   */
  projectRoot?: string
  /**
   * Whether the build should be outputted as a bundle
   */
  asBundle?: boolean
  /**
   * Force the current working directory.
   *
   * @default
   *
   * process.cwd()
   *
   * @remarks
   *
   * Interplay between this and projectRoot option: When the projectRoot is not forced then the cwd is utilized for various logic.
   */
  cwd?: string
}

/**
 * Perform a layout scan and return results with attached helper functions.
 */
export async function create(options?: Options): Promise<Either<Error, Layout>> {
  const cwd = options?.cwd ?? process.cwd()

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

  let projectRoot = options?.projectRoot
  let packageJson: null | Data['packageJson'] = null

  if (!projectRoot) {
    const maybeErrPackageJson = PJ.findRecurisvelyUpwardSync({ cwd })

    if (!maybeErrPackageJson) {
      projectRoot = cwd
    } else if (isLeft(maybeErrPackageJson.content)) {
      return maybeErrPackageJson.content
    } else {
      projectRoot = maybeErrPackageJson.dir
      packageJson = {
        ...maybeErrPackageJson,
        content: maybeErrPackageJson.content.right,
      }
    }
  }

  const errNormalizedEntrypoint = normalizeEntrypoint(options?.entrypointPath, projectRoot)
  if (isLeft(errNormalizedEntrypoint)) return errNormalizedEntrypoint
  const normalizedEntrypoint = errNormalizedEntrypoint.right

  const packageManagerType = await PackageManager.detectProjectPackageManager({ projectRoot })
  const maybeAppModule = normalizedEntrypoint ?? findAppModule({ projectRoot })

  const errTsConfig = await readOrScaffoldTsconfig({ projectRoot })
  if (isLeft(errTsConfig)) return errTsConfig
  const tsConfig = errTsConfig.right

  const nexusModules = findNexusModules(tsConfig, maybeAppModule)
  const project = packageJson
    ? {
        name: packageJson.content.name,
        isAnonymous: false,
      }
    : {
        name: 'anonymous',
        isAnonymous: true,
      }

  const scanResult = {
    app:
      maybeAppModule === null
        ? ({ exists: false, path: maybeAppModule } as const)
        : ({ exists: true, path: maybeAppModule } as const),
    projectRoot,
    sourceRoot: Path.normalize(tsConfig.content.options.rootDir!),
    nexusModules,
    project,
    tsConfig,
    packageManagerType,
  }

  if (scanResult.app.exists === false && scanResult.nexusModules.length === 0) {
    return left(noAppOrNexusModules({}))
  }

  const buildInfo = getBuildLayout(options?.buildOutputDir, scanResult, options?.asBundle)

  log.trace('layout build info', { data: buildInfo })

  const layout = createFromData({
    ...scanResult,
    packageJson,
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
 * Create a layout instance with given layout data. Useful for taking in serialized scan
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

const checks = {
  no_app_or_nexus_modules: {
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

const noAppOrNexusModules = exceptionType<'no_app_or_schema_modules', {}>(
  'no_app_or_schema_modules',
  checks.no_app_or_nexus_modules.explanations.problem +
    OS.EOL +
    checks.no_app_or_nexus_modules.explanations.solution
)

/**
 * Find the (optional) app module in the user's project.
 */
export function findAppModule(opts: { projectRoot: string }): string | null {
  log.trace('looking for app module')
  const path = findFile(`./**/${CONVENTIONAL_ENTRYPOINT_FILE_NAME}`, { cwd: opts.projectRoot })
  log.trace('done looking for app module', { path })
  return path
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

  if (isLeft(packageJson.content)) {
    return {
      type: 'malformed_package_json',
      error: packageJson.content.left,
    }
  }

  const pjc = rightOrThrow(packageJson.content) // will never throw, check above
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

/**
 * Validate the given entrypoint and normalize it into an absolute path.
 */
function normalizeEntrypoint(
  entrypoint: string | undefined,
  projectRoot: string
): Either<Error, string | undefined> {
  if (!entrypoint) {
    return right(undefined)
  }

  const absoluteEntrypoint = Path.isAbsolute(entrypoint) ? entrypoint : Path.join(projectRoot, entrypoint)

  if (!absoluteEntrypoint.endsWith('.ts')) {
    const error = exception('Entrypoint must be a .ts file', { path: absoluteEntrypoint })
    return left(error)
  }

  if (!FS.exists(absoluteEntrypoint)) {
    const error = exception('Entrypoint does not exist', { path: absoluteEntrypoint })
    return left(error)
  }

  return right(absoluteEntrypoint)
}

/**
 * Find the modules in the project that import nexus
 */
export function findNexusModules(tsConfig: Data['tsConfig'], maybeAppModule: string | null): string[] {
  try {
    log.trace('finding nexus modules')
    const project = new tsm.Project({
      addFilesFromTsConfig: false, // Prevent ts-morph from re-parsing the tsconfig
    })

    tsConfig.content.fileNames.forEach((f) => project.addSourceFileAtPath(f))

    const modules = project
      .getSourceFiles()
      .filter((s) => {
        // Do not add app module to nexus modules
        // todo normalize because ts in windows is like "C:/.../.../" instead of "C:\...\..." ... why???
        if (Path.normalize(s.getFilePath().toString()) === maybeAppModule) {
          return false
        }

        return s.getImportDeclaration('nexus') !== undefined
      })
      .map((s) => {
        // todo normalize because ts in windows is like "C:/.../.../" instead of "C:\...\..." ... why???
        return Path.normalize(s.getFilePath().toString())
      })

    log.trace('done finding nexus modules', { modules })

    return modules
  } catch (error) {
    // todo return left
    log.error('We could not find your nexus modules', { error })
    return []
  }
}
