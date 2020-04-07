import * as tsNode from 'ts-node'
import app from '../../index'
import { InternalApp } from '../../runtime/app'
import * as Start from '../../runtime/start'
import * as Layout from '../layout'
import { Dimension, DimensionToPlugin, Plugin, Manifest } from './types'
import { rootLogger } from '../nexus-logger'
import { PackageJson } from 'type-fest'
import { fatal } from '../process'
import { stripIndent } from 'common-tags'

const log = rootLogger.child('plugin')

export async function readAllPluginManifestsFromConfig(
  layout: Layout.Layout
): Promise<Manifest[]> {
  tsNode.register({
    transpileOnly: true,
  })

  // Run app to load plugins
  const runner = Start.createDevAppRunner(layout, [], {
    disableServer: true,
  })

  await runner.start()

  const validPlugins = validatePlugins((app as InternalApp).__state.plugins)

  log.trace('loaded plugins', { validPlugins })

  return validPlugins.map(pluginToManifest)
}

export function pluginToManifest(manifest: Plugin): Manifest {
  try {
    const packageJson = require(manifest.packageJsonPath) as PackageJson

    if (!packageJson.name) {
      fatal(
        `One of your plugin has a missing required \`name\` property in its package.json`,
        {
          packageJsonPath: manifest.packageJsonPath,
          packageJson,
        }
      )
    }

    return {
      ...manifest,
      name: packageJson.name,
      packageJson,
    }
  } catch (error) {
    fatal(
      stripIndent`
       An error occured when reading the package.json of one of your Nexus plugin:

       ${error.stack ?? error}
    `,
      { plugin: manifest }
    )
  }
}

/**
 * Import the dimension of a plugin given its manifest
 */
export function importPluginDimension<D extends Dimension>(
  dimension: D,
  manifest: Manifest
): DimensionToPlugin<D> {
  // Should be guaranteed by importPluginDimensions
  if (!manifest[dimension]) {
    fatal(
      `We could not find the ${dimension} dimension of the Nexus plugin "${manifest.name}"`,
      { plugin: manifest }
    )
  }

  const exportInfo = manifest[dimension]!

  try {
    const importedPlugin = require(exportInfo.module)

    if (!importedPlugin[exportInfo.export]) {
      fatal(
        `Nexus plugin "${manifest.name}" has no export \`${exportInfo.export}\` in ${exportInfo.module}`,
        { plugin: manifest }
      )
    }

    const plugin = importedPlugin[exportInfo.export]

    if (typeof plugin !== 'function') {
      fatal(
        `Nexus plugin "${manifest.name}" does not export a valid ${dimension} plugin`,
        { plugin: manifest }
      )
    }

    return plugin(manifest.settings)
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

export function isValidManifest(plugin: any): plugin is Plugin<any> {
  const hasPackageJsonPath = 'packageJsonPath' in plugin

  return hasPackageJsonPath
}

export function validatePlugins(manifests: Plugin<any>[]) {
  const invalidManifests = manifests.filter((m) => !isValidManifest(m))

  if (invalidManifests.length > 0) {
    log.warn(
      `Some invalid plugins were passed to Nexus. They are being ignored.`,
      {
        invalidPlugins: invalidManifests,
      }
    )
  }

  const validManifests = manifests.filter(isValidManifest)

  return validManifests
}

/**
 * Import the dimension of several plugins given their manifests
 */
export function importPluginsDimension<D extends Dimension>(
  dimension: D,
  manifests: Manifest[]
): {
  manifest: Manifest
  plugin: DimensionToPlugin<D>
}[] {
  return manifests
    .filter((manifest) => manifest[dimension] !== undefined)
    .map((manifest) => ({
      manifest,
      plugin: importPluginDimension(dimension, manifest),
    }))
}
