import * as Layout from '../layout'
import { rootLogger } from '../nexus-logger'
import { entrypointToManifest, filterValidPlugins, importPluginDimension } from './import'
import { createBaseLens, createRuntimeLens, createWorktimeLens } from './lens'
import { Plugin } from './types'

const log = rootLogger.child('plugin')

/**
 * Fully import and load the runtime plugins, if any, amongst the given plugins.
 */
export async function importAndLoadRuntimePlugins(plugins: Plugin[]) {
  return filterValidPlugins(plugins)
    .map(entrypointToManifest)
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
  return filterValidPlugins(plugins)
    .map(entrypointToManifest)
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
  return filterValidPlugins(plugins)
    .map(entrypointToManifest)
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
