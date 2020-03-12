import { findFiles } from '../../utils/path'

export function find(
  pattern?: string,
  opts: { cwd: string } = { cwd: process.cwd() }
): Promise<string[]> {
  return findFiles(pattern ?? './**/*.ts', opts)
}
