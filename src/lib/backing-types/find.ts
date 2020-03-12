import { findFiles } from '../../utils/path'

export const DEFAULT_BACKING_TYPES_GLOB = `./**/*.ts`

export function find(
  pattern?: string,
  opts: { cwd: string } = { cwd: process.cwd() }
): Promise<string[]> {
  return findFiles(pattern ?? DEFAULT_BACKING_TYPES_GLOB, opts)
}
