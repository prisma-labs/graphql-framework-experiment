import { findFiles } from '../fs'
import { rootLogger } from '../nexus-logger'

const log = rootLogger.child('backingTypes')

export async function find(pattern: string, opts?: { cwd?: string }): Promise<string[]> {
  const files = await findFiles(pattern, opts)

  log.trace('backing-types files to extract from', {
    files,
    cwd: opts?.cwd,
  })

  return files
}
