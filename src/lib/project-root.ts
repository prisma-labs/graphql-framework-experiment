import * as Path from 'path'

export function getProjectRoot() {
  const localPackageJsonDir = Path.dirname(
    require.resolve('../../package.json')
  )

  const projectRoot = Path.resolve(localPackageJsonDir, '..', '..')

  return projectRoot
}
