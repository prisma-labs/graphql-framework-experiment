import { findFile, findFiles, findSchemaDirOrModules, pog } from '../utils'
import * as Path from 'path'

const log = pog.sub('layout')

export function calcSourceRootToModule(layout: Layout, modulePath: string) {
  return Path.relative(layout.sourceRoot, modulePath)
}

export type Layout = {
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
 * Analyze the user's project files/folders for how conventions are being used
 * and where key modules exist.
 */
export const scan = async (): Promise<Layout> => {
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

  const result = {
    app:
      maybeAppModule === null
        ? ({ exists: false, path: maybeAppModule } as const)
        : ({ exists: true, path: maybeAppModule } as const),
    sourceRoot,
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
