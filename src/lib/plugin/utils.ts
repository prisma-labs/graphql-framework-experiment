import { isLeft, toError, tryCatch } from 'fp-ts/lib/Either'
import * as fs from 'fs-jetpack'
import * as Path from 'path'
import { PackageJson } from 'type-fest'
import * as Layout from '../layout'
import { rootLogger } from '../nexus-logger'
import { fatal } from '../process'
import * as Reflection from '../reflection/reflect'
import { getPackageJsonMain } from '../utils'
import { Dimension, DimensionEntrypointLocation, Manifest, Plugin, ValidatedPackageJson } from './types'

const log = rootLogger.child('plugin')

/**
 * Normalize a raw plugin manifest.
 *
 * @remarks
 *
 * The raw plugin manifest is what the plugin author defined. This supplies
 * defaults and fulfills properties to produce standardized manifest data.
 */
export async function getPluginManifest(plugin: Plugin): Promise<Manifest> {
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

  const [worktime, runtime, testtime] = await Promise.all([
    getDimensionEntrypointLocation('worktime', validatedPackageJson, plugin),
    getDimensionEntrypointLocation('runtime', validatedPackageJson, plugin),
    getDimensionEntrypointLocation('testtime', validatedPackageJson, plugin),
  ])

  return {
    name: packageJson.name,
    settings: (plugin as any).settings ?? null,
    packageJsonPath: plugin.packageJsonPath,
    packageJson: validatedPackageJson,
    worktime,
    testtime,
    runtime,
  }
}

/**
 * Get the dimension entrypoint location. Take it from the manifest input if
 * present. Otherwise check on disk for the conventional module.
 *
 * The conventional dimension module location is:
 *
 * <project-root>/<main dir>/{runtime,worktime,testtime}.js
 * <project-root>/<main dir>/{runtime,worktime,testtime}/index.js
 *
 * The location path extension is not specified to afford plugin author the
 * index dir style. This means the location path must be passed into a
 * node-module-resolution functino e.g. `require`. Do not pass it to a raw FS
 * file read function.
 */
async function getDimensionEntrypointLocation(
  dimensionkind: Dimension,
  packageJson: ValidatedPackageJson,
  plugin: Plugin
): Promise<DimensionEntrypointLocation | null> {
  if (plugin[dimensionkind]) return plugin[dimensionkind]!

  const dimensionEntrypointPath = Path.join(getPackageJsonMain(packageJson), dimensionkind)
  const conventionalPath = Path.join(Path.dirname(plugin.packageJsonPath), dimensionEntrypointPath)

  if (await fs.existsAsync(conventionalPath)) {
    return {
      module: dimensionEntrypointPath,
      export: 'plugin',
    }
  }

  return null
}

/**
 * This gets all the plugins in use in the app.
 *
 * @remarks
 *
 * This is useful for the CLI to get worktime plugins. This will run the app in
 * data mode, in this process.
 */
export async function getUsedPlugins(layout: Layout.Layout): Promise<Plugin[]> {
  try {
    const reflection = await Reflection.reflect(layout, { usedPlugins: true, onMainThread: true })

    if (!reflection.success) {
      throw reflection.error
    }

    log.trace('got used plugins', { validPlugins: reflection.plugins })

    return reflection.plugins
  } catch (e) {
    fatal('Failed to scan app for used plugins because there is a runtime error in the app', {
      error: e,
    })
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
