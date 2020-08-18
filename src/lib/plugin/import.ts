import { stripIndent } from 'common-tags'
import { fatal } from '../process'
import { Dimension, DimensionToPlugin, Manifest } from './types'

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
