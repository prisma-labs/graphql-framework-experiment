import * as FS from 'fs-jetpack'
import { FSJetpack } from 'fs-jetpack/types'
import slash from 'slash'
import { createContributor } from './compose-create'

export type FsDeps = {
  tmpDir: string
}

export type FsContribution = {
  fs: FSJetpack
  /**
   * Turn given relative path into absolute one.
   *
   * Relative to the curerntly setup tmpDir.
   *
   * Path is normalized to posix meaning e.g. `C:\a\b\c` becomes `C:/a/b/c`.
   */
  path(...relativePath: string[]): string
}

/**
 * - Creates a temporary directory
 * - Adds `fs` to `context`, an fs-jetpack instance with its cwd set to the tmpdir
 */
export const fs = () =>
  createContributor<FsDeps, FsContribution>((ctx) => {
    const fs = FS.cwd(ctx.tmpDir)

    function path(...relativePath: string[]) {
      return slash(fs.path(...relativePath))
    }

    return {
      fs,
      path,
    }
  })
