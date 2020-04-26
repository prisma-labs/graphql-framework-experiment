import { stripIndent } from 'common-tags'
import { PackageJson } from 'type-fest'
import app from '../../index'
import { InternalApp } from '../../runtime/app'
import * as Start from '../../runtime/start'
import * as Layout from '../layout'
import { rootLogger } from '../nexus-logger'
import { fatal } from '../process'
import { registerTypeScriptTranspile } from '../tsc'
import { Manifest, Plugin } from './types'

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
