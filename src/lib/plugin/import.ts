import { stripIndent } from 'common-tags'
import { PackageJson } from 'type-fest'
import app from '../../index'
import { InternalApp } from '../../runtime/app'
import * as Start from '../../runtime/start'
import * as Layout from '../layout'
import { rootLogger } from '../nexus-logger'
import { fatal } from '../process'
import { registerTypeScriptTranspile } from '../tsc'
import { partition } from '../utils'
import { Dimension, DimensionToPlugin, Manifest, Plugin } from './types'

const log = rootLogger.child('plugin')

/**
 * This gets all the plugins in use in the app.
 *
 * @remarks
 *
 * This is useful for the CLI to get worktime plugins. This will run the app in
 * data mode, in this process.
 */
export async function getUsedPlugins(layout: Layout.Layout): Promise<Plugin[]> {
  registerTypeScriptTranspile({})

  const runner = Start.createDevAppRunner(layout, {
    disableServer: true,
  })
  try {
    await runner.start()
  } catch (e) {
    fatal('Failed to scan app for used plugins because there is a runtime error in the app', {
      error: e,
    })
  }

  const plugins = (app as InternalApp).__state.plugins

  log.trace('loaded plugin entrypoints', { validPlugins: plugins })

  return plugins
}

/**
 * Normalize a raw plugin manifest.
 *
 * @remarks
 *
 * The raw plugin manifest is what the plugin author defined. This supplies
 * defaults and fulfills properties to produce standardized manifest data.
 */
export function entrypointToManifest(plugin: Plugin): Manifest {
  try {
    const packageJson = require(plugin.packageJsonPath) as PackageJson

    if (!packageJson.name) {
      fatal(`One of your plugin has a missing required \`name\` property in its package.json`, {
        packageJsonPath: plugin.packageJsonPath,
        packageJson,
      })
    }

    return {
      ...plugin,
      name: packageJson.name,
      packageJson,
    }
  } catch (error) {
    fatal(
      stripIndent`
       An error occured when reading the package.json of one of your Nexus plugin:

       ${error.stack ?? error}
    `,
      { plugin }
    )
  }
}

/**
 * Import the dimension of a plugin.
 */
export function importPluginDimension<D extends Dimension>(
  dimension: D,
  manifest: Manifest
): DimensionToPlugin<D> {
  // Should be guaranteed by importPluginDimensions
  if (!manifest[dimension]) {
    fatal(`We could not find the ${dimension} dimension of the Nexus plugin "${manifest.name}"`, {
      plugin: manifest,
    })
  }

  const dimensionEntrypoint = manifest[dimension]!

  try {
    const dimensionModule = require(dimensionEntrypoint.module)

    if (!dimensionModule[dimensionEntrypoint.export]) {
      fatal(
        `Nexus plugin "${manifest.name}" has no export \`${dimensionEntrypoint.export}\` in ${dimensionEntrypoint.module}`,
        { plugin: manifest }
      )
    }

    const plugin = dimensionModule[dimensionEntrypoint.export]

    if (typeof plugin !== 'function') {
      fatal(`Nexus plugin "${manifest.name}" does not export a valid ${dimension} plugin`, {
        plugin: manifest,
      })
    }

    const innerPlugin = plugin(manifest.settings)

    if (typeof innerPlugin !== 'function') {
      fatal(`Nexus plugin "${manifest.name}" does not export a valid ${dimension} plugin`, {
        plugin: manifest,
      })
    }

    return innerPlugin
  } catch (error) {
    fatal(
      stripIndent`
    An error occured while loading the Nexus plugin "${manifest.name}":

    ${error}
  `,
      { plugin: manifest }
    )
  }
}

export type ImportedPlugin<D extends Dimension> = { manifest: Manifest; run: DimensionToPlugin<D> }

/**
 * Import dimensions from multiple plugins.
 */
export function importPluginsDimension<D extends Dimension>(
  dimension: D,
  manifests: Manifest[]
): ImportedPlugin<D>[] {
  return manifests
    .filter((m) => m[dimension])
    .map((m) => {
      return {
        run: importPluginDimension(dimension, m),
        manifest: m,
      }
    })
}

/**
 * Predicate function, is the given plugin a valid one.
 */
export function isValidPlugin(plugin: any): plugin is Plugin {
  const hasPackageJsonPath = 'packageJsonPath' in plugin
  return hasPackageJsonPath
}

/**
 * Return only valid plugins. Invalid plugins will be logged as a warning.
 */
export function filterValidPlugins(plugins: Plugin[]) {
  const [validPlugins, invalidPlugins] = partition(plugins, isValidPlugin)

  if (invalidPlugins.length > 0) {
    log.warn(`Some invalid plugins were passed to Nexus. They are being ignored.`, {
      invalidPlugins,
    })
  }

  return validPlugins
}
