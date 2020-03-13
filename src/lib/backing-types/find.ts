import { findFiles } from '../../utils/path'
import { rootLogger } from '../../utils/logger'

const log = rootLogger.child('backing-types')

export const DEFAULT_BACKING_TYPES_GLOB = `./**/*.ts`

export async function find(
  pattern?: string,
  opts?: { cwd?: string }
): Promise<string[]> {
  const files = await findFiles(pattern ?? DEFAULT_BACKING_TYPES_GLOB, opts)

  log.trace('backing-types files to extract from', { files })

  return files
}
