// import * as Path from 'path'

// /**
//  * Find project root based on the location of this file
//  */
// export function getProjectRoot() {
//   if (process.env.LINK) {
//     return process.cwd()
//   }

//   const localPackageJsonDir = Path.dirname(
//     require.resolve('../../package.json')
//   )

//   const projectRoot = Path.resolve(localPackageJsonDir, '..', '..')

//   return projectRoot
// }

/**
 * Find project root based on the location of this file
 */
export function getProjectRoot() {
  return process.cwd()
}
