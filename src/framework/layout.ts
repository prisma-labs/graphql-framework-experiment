import {
  findFile,
  findSchemaDirOrModules,
  pog,
  stripExt,
  findConfigFile,
} from '../utils'
import * as Path from 'path'

const log = pog.sub('layout')

/**
 * Layout represents the important edges of the project to support things like
 * scaffolding, build, and dev against the correct paths.
 */
export type Data = {
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
  sourceRoot: string
  sourceRootRelative: string
  projectRoot: string
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

export type Layout = Data & {
  /**
   * Property that aliases all the and only the data properties, makes it
   * easy to e.g. serialize just the data.
   */
  data: Data
  projectRelative(filePath: string): string
  sourceRelative(filePath: string): string
  sourcePath(subPath: string): string
}

/**
 * Perform a layout scan and return results with attached helper functions.
 */
export async function create(): Promise<Layout> {
  const data = await scan()
  return createFromData(data)
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
  }
}

/**
 * Analyze the user's project files/folders for how conventions are being used
 * and where key modules exist.
 */
export const scan = async (): Promise<Data> => {
  log('starting scan...')
  const maybeAppModule = await findAppModule()
  const maybeSchemaModules = findSchemaDirOrModules()

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

  const result = {
    app:
      maybeAppModule === null
        ? ({ exists: false, path: maybeAppModule } as const)
        : ({ exists: true, path: maybeAppModule } as const),
    projectRoot,
    sourceRoot,
    sourceRootRelative: Path.relative(projectRoot, sourceRoot),
  }

  log('...completed scan with result: %O', result)

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
  let packageJsonPath = findConfigFile('package.json', { required: false })

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
