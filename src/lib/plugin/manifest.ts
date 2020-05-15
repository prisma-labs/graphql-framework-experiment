import { Either, isLeft, isRight, left, Left, right, Right, toError, tryCatch } from 'fp-ts/lib/Either'
import { PackageJson } from 'type-fest'
import { fatal } from '../process'
import { ContextualError, createContextualError } from '../utils'
import { Manifest, Plugin, ValidatedPackageJson } from './types'

export type GetManifestError = ContextualError<{
  plugin: Plugin
  name?: string
}>

/**
 * Process manifest input into a manifest.
 *
 * @remarks
 *
 * The manifest input is what the plugin author provides. This supplies
 * defaults and fulfills properties to produce normalized manifest data.
 */
export function getPluginManifest(plugin: Plugin): Either<GetManifestError, Manifest> {
  const errPackageJson = tryCatch(() => require(plugin.packageJsonPath) as PackageJson, toError)

  if (isLeft(errPackageJson)) {
    return left(
      createContextualError(`Failed to read the the package.json file.\n\n${errPackageJson.left.message}`, {
        plugin,
      })
    )
  }

  const packageJson = errPackageJson.right

  if (!packageJson.name) {
    return left(
      createContextualError(`\`name\` property is missing in package.json`, {
        plugin,
        name: packageJson.name!,
      })
    )
  }

  if (!packageJson.main) {
    return left(
      createContextualError(`\`main\` property is missing in package.json`, {
        plugin,
        name: packageJson.name!,
      })
    )
  }

  const validatedPackageJson = packageJson as ValidatedPackageJson

  return right({
    name: validatedPackageJson.name,
    settings: (plugin as any).settings ?? null,
    packageJsonPath: plugin.packageJsonPath,
    packageJson: validatedPackageJson,
    worktime: plugin.worktime ?? null,
    testtime: plugin.testtime ?? null,
    runtime: plugin.runtime ?? null,
  })
}

/**
 * Display erorrs then exit the program.
 */
export function showManifestErrorsAndExit(errors: GetManifestError[]): never {
  const message =
    `There were errors loading 1 or more of your plugins.\n\n` +
    errors
      .map((e) => {
        const name = `${e.context.name ? `"${e.context.name}"` : '<unknown>'}`
        const path = e.context.plugin.packageJsonPath
        return `from plugin ${name} at path ${path}\n\n${e.message}`
      })
      .join('\n\n')
  fatal(message)
}

/**
 * Process the given manifest inputs into manifests
 */
export function getPluginManifests(plugins: Plugin[]) {
  // todo this function is a temp helper until we better adopt fp-ts and use its
  // other features. the process of partitioning, processing, and branching over Either has lots of
  // support in fp-ts lib.
  const errManifests = plugins.map(getPluginManifest)
  const data = errManifests.filter<Right<Manifest>>(isRight).map((m) => m.right)
  const errors = errManifests.filter<Left<GetManifestError>>(isLeft).map((m) => m.left)
  return { data, errors }
}
