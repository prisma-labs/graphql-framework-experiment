import * as Path from 'path'
import { findFileRecurisvelyUpwardSync } from '../fs'

/**
 * Handoff execution from a global to local version of a package.
 *
 * If the given global module path is not a real node package (defined as being
 * unable to locate its package.json file) then an error will be thrown.
 */
export function globalToLocalModule(input: { localPackageDir: string; globalPackageFilename: string }) {
  const globalProjectDir = findFileRecurisvelyUpwardSync('package.json', {
    cwd: Path.dirname(input.globalPackageFilename),
  })?.dir

  if (!globalProjectDir) {
    throw new Error(
      `Could not perform handoff to local package version because the given global package does not appear to actually be a package:\n\n${input.globalPackageFilename}`
    )
  }

  require(Path.join(input.localPackageDir, Path.relative(globalProjectDir, input.globalPackageFilename)))
}
