import { findFiles } from '../../utils/path'

export function find(pattern?: string): Promise<string[]> {
  return findFiles(pattern ?? './**/*.ts')
}
