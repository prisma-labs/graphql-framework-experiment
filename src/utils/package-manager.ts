/**
 * This module deals with abstractions around if the user's project is npm or
 * yarn based. Sometimes messages need to be written with one of these tools in
 * mind, or spawns must be executed using one of these tools. The one to use is
 * typically a reflection of what the user has chosen in their project. This
 * module provides utilities for working in code with the package managers in an
 * agnostic way.
 */
import * as fsHelpers from './fs'

const YARN_LOCK_FILE_NAME = 'yarn.lock'
const NPM_LOCK_FILE_NAME = 'package-lock.json'

type PackageManagerType = 'yarn' | 'npm'

/**
 * Detect if the project is yarn or npm based. Detection is based on the kind of
 * lock file present. If nothing is found, npm is assumed.
 */
export async function detectProjectPackageManager(): Promise<
  PackageManagerType
> {
  const packageManagerFound = await Promise.race([
    fsHelpers
      .findFileRecurisvelyUpward(YARN_LOCK_FILE_NAME)
      .then(maybeFilePath => (maybeFilePath !== null ? 'yarn' : null)),
    fsHelpers
      .findFileRecurisvelyUpward(NPM_LOCK_FILE_NAME)
      .then(maybeFilePath => (maybeFilePath !== null ? 'npm' : null)),
  ])

  return packageManagerFound === null ? 'npm' : packageManagerFound
}

/**
 * Render a string of the given command as coming from the local bin.
 */
export function renderRunBin(
  packageManagerType: PackageManagerType,
  commandString: string
): string {
  return packageManagerType === 'npm'
    ? `npx ${commandString}`
    : `yarn -s ${commandString}`
}

/**
 * The package manager as a fluent API, all statics partially applied with the
 * package manager type.
 */
export type PackageManager = {
  type: PackageManagerType
  renderRunBin: (commandString: string) => string
}

/**
 * Create a fluent package manager module api. This partially applies all
 * statics with the package manager type. Creation is async since it requires
 * running IO to detect the project's package manager.
 */
export async function create(): Promise<PackageManager> {
  const packageManagerType = await detectProjectPackageManager()

  return {
    type: packageManagerType,
    renderRunBin: renderRunBin.bind(null, packageManagerType),
  }
}
