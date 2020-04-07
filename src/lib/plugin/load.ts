import * as Layout from '../layout'
import { rootLogger } from '../nexus-logger'
import {
  importPluginsDimension,
  pluginToManifest,
  readAllPluginManifestsFromConfig,
  validatePlugins,
} from './import'
import { createBaseLens, createRuntimeLens, createWorktimeLens } from './lens'
import {
  InnerRuntimePlugin,
  InnerTesttimePlugin,
  InnerWorktimePlugin,
  Manifest,
  Plugin,
} from './types'

const log = rootLogger.child('plugin')

/**
 * Try to load a runtime plugin
 */
export function loadRuntimePlugin(
  pluginName: string,
  plugin: InnerRuntimePlugin
) {
  return plugin(createRuntimeLens(pluginName))
}

export async function loadRuntimePlugins(layout: Layout.Layout) {
  const manifests = await readAllPluginManifestsFromConfig(layout)

  return loadRuntimePluginsFromEntrypoints(manifests)
}

export async function loadRuntimePluginsFromEntrypoints(plugins: Plugin[]) {
  const validManifests = validatePlugins(plugins)
  const manifests = validManifests.map(pluginToManifest)
  const importedPlugins = importPluginsDimension('runtime', manifests)

  return importedPlugins.map(({ manifest, plugin }) =>
    loadRuntimePlugin(manifest.name, plugin)
  )
}

// Worktime loaders

export async function loadWorktimePlugins(layout: Layout.Layout) {
  const manifests = await readAllPluginManifestsFromConfig(layout)

  return loadWorktimePluginFromManifests(manifests, layout)
}

export async function loadWorktimePluginFromManifests(
  manifests: Manifest[],
  layout: Layout.Layout
) {
  return importPluginsDimension(
    'worktime',
    manifests
  ).map(({ plugin, manifest }) =>
    loadWorktimePlugin(layout, manifest.name, plugin)
  )
}

/**
 * Try to load a worktime plugin
 */
export function loadWorktimePlugin(
  layout: Layout.Layout,
  pluginName: string,
  plugin: InnerWorktimePlugin
) {
  const lens = createWorktimeLens(layout, pluginName)

  plugin(lens)

  return {
    name: pluginName,
    // plugin will have hooked onto hooks now, and framework will call those hooks
    hooks: lens.hooks,
  }
}

// Testtime loaders

export async function loadTesttimePlugins(layout: Layout.Layout) {
  const manifests = await readAllPluginManifestsFromConfig(layout)

  return loadTesttimePluginsFromManifests(manifests)
}

export async function loadTesttimePluginsFromManifests(manifests: Manifest[]) {
  return importPluginsDimension(
    'testtime',
    manifests
  ).map(({ manifest, plugin }) => loadTesttimePlugin(manifest.name, plugin))
}

/**
 * Try to load a testtime plugin
 */
export function loadTesttimePlugin(
  pluginName: string,
  plugin: InnerTesttimePlugin
) {
  return plugin(createBaseLens(pluginName))
}
