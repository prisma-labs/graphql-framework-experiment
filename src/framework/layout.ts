import { findFile } from '../utils'

type ScanResult = {
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
export const scan = async (): Promise<ScanResult> => {
  const maybeAppModule = await findAppModule()

  return {
    app:
      maybeAppModule === null
        ? { exists: false, path: maybeAppModule }
        : { exists: true, path: maybeAppModule },
  }
}

/**
 * Find the (optional) app module in the user's project.
 */
export const findAppModule = async () => {
  return findFile(['app.ts', 'server.ts', 'service.ts'])
}
