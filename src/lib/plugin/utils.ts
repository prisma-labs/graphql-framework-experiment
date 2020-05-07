import { stripIndent } from 'common-tags'
import { PackageJson } from 'type-fest'
import * as Layout from '../layout'
import { rootLogger } from '../nexus-logger'
import { fatal } from '../process'
import { Manifest, Plugin } from './types'
import * as Reflection from '../reflection/reflect'

const log = rootLogger.child('plugin')

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
