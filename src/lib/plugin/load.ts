import * as Layout from '../layout'
import { rootLogger } from '../nexus-logger'
import { partition } from '../utils'
import { importPluginDimension } from './import'
import { createBaseLens, createRuntimeLens, createWorktimeLens } from './lens'
import { getPluginManifest } from './manifest'
import { Plugin } from './types'

const log = rootLogger.child('plugin')

/**
 * Fully import and load the runtime plugins, if any, amongst the given plugins.
 */
export async function importAndLoadRuntimePlugins(plugins: Plugin[]) {
  const validPlugins = filterValidPlugins(plugins)
  const pluginManifests = await Promise.all(validPlugins.map(getPluginManifest))
  return pluginManifests
    .filter((m) => m.runtime)
    .map((m) => {
      return {
        run: importPluginDimension('runtime', m),
        manifest: m,
      }
    })
    .map((plugin) => {
      log.trace('loading runtime plugin', { name: plugin.manifest.name })
      return plugin.run(createRuntimeLens(plugin.manifest.name))
    })
}

/**
 * Fully import and load the worktime plugins, if any, amongst the given plugins.
 */
export async function importAndLoadWorktimePlugins(plugins: Plugin[], layout: Layout.Layout) {
  const validPlugins = filterValidPlugins(plugins)
  const pluginManifests = await Promise.all(validPlugins.map(getPluginManifest))

  return pluginManifests
    .filter((m) => m.worktime)
    .map((m) => {
      return {
        run: importPluginDimension('worktime', m),
        manifest: m,
      }
    })
    .map((plugin) => {
      log.trace('loading worktime plugin', { name: plugin.manifest.name })
      const lens = createWorktimeLens(layout, plugin.manifest.name)

      plugin.run(lens)

      return {
        name: plugin.manifest.name,
        // plugin will have hooked onto hooks via mutation now, and framework
        // will call those hooks
        hooks: lens.hooks,
      }
    })
}

/**
 * Fully import and load the testtime plugins, if any, amongst the given plugins.
 */
export async function importAndLoadTesttimePlugins(plugins: Plugin[]) {
  const validPlugins = filterValidPlugins(plugins)
  const pluginManifests = await Promise.all(validPlugins.map(getPluginManifest))

  return pluginManifests
    .filter((m) => m.testtime)
    .map((m) => {
      return {
        run: importPluginDimension('testtime', m),
        manifest: m,
      }
    })
    .map((plugin) => {
      log.trace('loading testtime plugin', { name: plugin.manifest.name })
      return plugin.run(createBaseLens(plugin.manifest.name))
    })
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

/**
 * Predicate function, is the given plugin a valid one.
 */
export function isValidPlugin(plugin: any): plugin is Plugin {
  const hasPackageJsonPath = 'packageJsonPath' in plugin
  return hasPackageJsonPath
}
