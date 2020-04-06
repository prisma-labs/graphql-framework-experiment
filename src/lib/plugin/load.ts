import { stripIndent } from 'common-tags'
import prompts from 'prompts'
import * as Layout from '../../lib/layout'
import { shouldGenerateArtifacts } from '../../runtime/schema/settings'
import { rootLogger } from '../nexus-logger'
import { fatal, run, runSync } from '../process'
import { importAllPlugins, Plugin } from './import'
import {
  Lens,
  RuntimeLens,
  RuntimePlugin,
  TesttimeContributions,
  WorktimeHooks,
  WorktimeLens,
} from './index'

type Dimension = 'worktime' | 'runtime' | 'testtime'

const log = rootLogger.child('plugin')

function createBaseLens(pluginName: string): Lens {
  return {
    log: log.child(pluginName),
    run: run,
    runSync: runSync,
    prompt: prompts,
  }
}

/**
 * Load all workflow plugins that are installed into the project.
 */
export async function loadInstalledWorktimePlugins(
  layout: Layout.Layout
): Promise<{ name: string; hooks: WorktimeHooks }[]> {
  const plugins = await importAllPlugins(layout)
  const worktimePlugins = plugins.filter((plugin) => plugin.worktime)
  const contributions = worktimePlugins.map((plugin) => {
    return loadWorktimePlugin(layout, plugin)
  })

  return contributions
}

//prettier-ignore
export async function loadInstalledTesttimePlugins(layout: Layout.Layout): Promise<TesttimeContributions[]> {
  const plugins = await importAllPlugins(layout)
  return plugins.filter(plugin => plugin.testtime).map(loadTesttimePlugin)
}

function createWorktimeLens(
  layout: Layout.Layout,
  pluginName: string
): WorktimeLens {
  return {
    ...createBaseLens(pluginName),
    layout: layout,
    packageManager: layout.packageManager,
    hooks: {
      create: {},
      dev: {
        addToWatcherSettings: {},
      },
      build: {},
      generate: {},
    },
  }
}

/**
 * Try to load a worktime plugin
 */
export function loadWorktimePlugin(layout: Layout.Layout, plugin: Plugin) {
  const lens = createWorktimeLens(layout, plugin.name)

  loadPlugin('worktime', plugin, lens)

  return {
    name: plugin.name,
    // plugin will have hooked onto hooks now, and framework will call those hooks
    hooks: lens.hooks,
  }
}

/**
 * Try to load a testtime plugin
 */
export function loadTesttimePlugin(plugin: Plugin) {
  return loadPlugin('testtime', plugin, createBaseLens(plugin.name))
}

function createRuntimeLens(pluginName: string): RuntimeLens {
  return {
    ...createBaseLens(pluginName),
    shouldGenerateArtifacts: shouldGenerateArtifacts(),
  }
}

/**
 * Try to load a runtime plugin
 */
export function loadRuntimePlugin(pluginName: string, plugin: RuntimePlugin) {
  return loadPlugin(
    'runtime',
    { name: pluginName, runtime: plugin },
    createRuntimeLens(pluginName)
  )
}

/**
 * Try to load the given dimension of the given plugin.
 */
export function loadPlugin<D extends Dimension, P extends Plugin>(
  dimension: D,
  plugin: P,
  lens: Lens
): ReturnType<NonNullable<P[D]>> {
  log.trace('load', { dimension: dimension, plugin: plugin.name })
  try {
    const dim = plugin[dimension]
    // caller  must:
    // check given plugin has given dimenesion
    // pass correct lens type for given plugin
    return dim!(lens as any) as any
  } catch (error) {
    fatal(
      stripIndent`
          Error while trying to load the ${dimension} dimension of plugin "${plugin.name}":
          
          ${error}
        `
    )
  }
}
