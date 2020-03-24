import * as Path from 'path'

/**
 * Find project root based on the location of this file
 */
export function getProjectRoot() {
  const localPackageJsonDir = Path.dirname(
    require.resolve('../../package.json')
  )

  const projectRoot = Path.resolve(localPackageJsonDir, '..', '..')

  return projectRoot
}
