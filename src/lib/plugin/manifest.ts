import { isLeft, toError, tryCatch } from 'fp-ts/lib/Either'
import { PackageJson } from 'type-fest'
import { fatal } from '../process'
import { Manifest, Plugin, ValidatedPackageJson } from './types'

/**
 * Process manifest input into a manifest.
 *
 * @remarks
 *
 * The manifest input is what the plugin author provides. This supplies
 * defaults and fulfills properties to produce normalized manifest data.
 */
export function getPluginManifest(plugin: Plugin): Manifest {
  const errPackageJson = tryCatch(() => require(plugin.packageJsonPath) as PackageJson, toError)

  if (isLeft(errPackageJson)) {
    fatal(
      createGetManifestError(
        addErrorMessageContext(`Failed to read the the plugin's package.json file.`, errPackageJson.left)
      ),
      { plugin }
    )
  }

  const packageJson = errPackageJson.right

  if (!packageJson.name) {
    fatal(createGetManifestError(new Error(`\`name\` property is missing in package.json`)), {
      packageJson: {
        data: packageJson,
        path: plugin.packageJsonPath,
      },
    })
  }

  if (!packageJson.main) {
    fatal(createGetManifestError(new Error(`\`main\` property is missing in package.json`)), {
      packageJson: {
        data: packageJson,
        path: plugin.packageJsonPath,
      },
    })
  }

  const validatedPackageJson = packageJson as ValidatedPackageJson

  return {
    name: packageJson.name,
    settings: (plugin as any).settings ?? null,
    packageJsonPath: plugin.packageJsonPath,
    packageJson: validatedPackageJson,
    worktime: plugin.worktime ?? null,
    testtime: plugin.testtime ?? null,
    runtime: plugin.runtime ?? null,
  }
}

// helpers

function addErrorMessageContext(additionalMessage: string, error: Error): Error {
  error.message = `${additionalMessage}\n\n${error.message}`
  return error
}

function createGetManifestError(error: Error): Error {
  return new Error(`An error occured whlie loading one of the plugins you are using.\n\n${error.message}`)
}
