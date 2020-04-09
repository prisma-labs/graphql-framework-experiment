import { findFiles } from '../fs'
import { rootLogger } from '../nexus-logger'

const log = rootLogger.child('backing-types')

export const DEFAULT_BACKING_TYPES_GLOB = `./**/*.ts`

export async function find(pattern?: string, opts?: { cwd?: string }): Promise<string[]> {
  const files = await findFiles(pattern ?? DEFAULT_BACKING_TYPES_GLOB, opts)

  log.trace('backing-types files to extract from', {
    files,
    cwd: opts?.cwd,
  })

  return files
}
