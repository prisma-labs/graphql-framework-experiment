/**
 * This module deals with abstractions around if the user's project is npm or
 * yarn based. Sometimes messages need to be written with one of these tools in
 * mind, or spawns must be executed using one of these tools. The one to use is
 * typically a reflection of what the user has chosen in their project. This
 * module provides utilities for working in code with the package managers in an
 * agnostic way.
 */
import * as fsHelpers from './fs'
import * as proc from './process'
import { OmitFirstArg } from './helpers'

const YARN_LOCK_FILE_NAME = 'yarn.lock'
const NPM_LOCK_FILE_NAME = 'package-lock.json'

export type PackageManagerType = 'yarn' | 'npm'

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
  pmt: PackageManagerType,
  commandString: string
): string {
  return pmt === 'npm' ? `npx ${commandString}` : `yarn -s ${commandString}`
}

/**
 * Run a command from the local project bin.
 */
export function run(
  pmt: PackageManagerType,
  commandString: string,
  options: proc.RunOptions
): ReturnType<typeof proc.run> {
  const packageManagerCommand = renderRunBin(pmt, commandString)
  return proc.run(packageManagerCommand, options)
}

/**
 * Run package installation.
 */
export function installDeps(
  pmt: PackageManagerType,
  options: proc.RunOptions
): ReturnType<typeof proc.run> {
  return pmt === 'npm'
    ? proc.run('npm install', options)
    : proc.run('yarn install', options)
}

/**
 * Add a package to the project.
 */
export function addDeps(
  pmt: PackageManagerType,
  packages: string[],
  options: { dev?: boolean } & proc.RunOptions
): ReturnType<typeof proc.run> {
  const dev = options.dev ?? false
  return pmt === 'npm'
    ? proc.run(`npm install ${dev ? '--save-dev' : ''}`, options)
    : proc.run(`yarn add ${dev ? '--dev' : ''} ${packages.join(' ')}`, options)
}

//
// Fluent API
//

/**
 * The package manager as a fluent API, all statics partially applied with the
 * package manager type.
 */
export type PackageManager = {
  type: PackageManagerType
  installDeps: OmitFirstArg<typeof installDeps>
  addDeps: OmitFirstArg<typeof addDeps>
  run: OmitFirstArg<typeof run>
  renderRun: OmitFirstArg<typeof renderRunBin>
}

/**
 * Create a fluent package manager module api. This partially applies all
 * statics with the package manager type. Creation is async since it requires
 * running IO to detect the project's package manager.
 */
export function create<T extends undefined | PackageManagerType>(
  givenPackageManagerType?: T
): T extends undefined ? Promise<PackageManager> : PackageManager

export function create(
  givenPackageManagerType?: undefined | PackageManagerType
): Promise<PackageManager> | PackageManager {
  return givenPackageManagerType === undefined
    ? detectProjectPackageManager().then(createDo)
    : createDo(givenPackageManagerType)
}

function createDo(pmt: PackageManagerType): PackageManager {
  return {
    type: pmt,
    renderRun: renderRunBin.bind(null, pmt),
    run: run.bind(null, pmt),
    installDeps: installDeps.bind(null, pmt),
    addDeps: addDeps.bind(null, pmt),
  }
}
