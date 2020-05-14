import { stripIndent } from 'common-tags'
import { PackageJson } from 'type-fest'
import { fatal } from '../process'
import { Manifest, Plugin } from './types'

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