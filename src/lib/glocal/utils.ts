import * as path from 'path'
import { findFileRecurisvelyUpwardSync } from '../fs'

/**
 * Handoff execution from a global to local version of a package.
 *
 * If the givne global module path is not a real node package (defined as being
 * unable to locate its package.json file) then an error will be thrown.
 */
export function globalToLocalModule(input: { localPackageDir: string; globalPackageFilename: string }) {
  const globalProjectDir = findFileRecurisvelyUpwardSync('package.json', {
    cwd: path.dirname(input.globalPackageFilename),
  })?.dir

  if (!globalProjectDir) {
    throw new Error(
      `Could not perform handoff to local package version becuase the given global package does not appear to actually be a package:\n\n${input.globalPackageFilename}`
    )
  }

  require(path.join(input.localPackageDir, path.relative(globalProjectDir, input.globalPackageFilename)))
}
