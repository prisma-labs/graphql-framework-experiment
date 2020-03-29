import { stripIndent } from 'common-tags'
import prompts from 'prompts'
import * as Layout from '../../lib/layout'
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
  const plugins = await importAllPlugins()
  const worktimePlugins = plugins.filter(plugin => plugin.worktime)
  const contributions = worktimePlugins.map(plugin => {
    return loadWorktimePlugin(layout, plugin)
  })

  return contributions
}

//prettier-ignore
export async function loadInstalledTesttimePlugins(): Promise<TesttimeContributions[]> {
  const plugins = await importAllPlugins()
  return plugins.filter(plugin => plugin.testtime).map(loadTesttimePlugin)
}

function createWorktimeLens(
  layout: Layout.Layout,
  pluginName: string
): WorktimeLens {
  const lens: any = createBaseLens(pluginName)
  lens.layout = layout
  lens.packageManager = layout.packageManager
  return lens
}

/**
 * Try to load a worktime plugin
 */
export function loadWorktimePlugin(layout: Layout.Layout, plugin: Plugin) {
  const hooks: WorktimeHooks = {
    create: {},
    dev: {
      addToWatcherSettings: {},
    },
    build: {},
    generate: {},
  }

  loadPlugin('worktime', plugin, createWorktimeLens(layout, plugin.name))

  return {
    name: plugin.name,
    hooks: hooks,
  }
}

/**
 * Try to load a testtime plugin
 */
export function loadTesttimePlugin(plugin: Plugin) {
  return loadPlugin('testtime', plugin, createBaseLens(plugin.name))
}

function createRuntimeLens(pluginName: string): RuntimeLens {
  const lens: any = createBaseLens(pluginName)
  lens.isBuild = process.env.NEXUS_BUILD === 'true'
  return lens
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
    const dim: any = plugin[dimension]
    return dim(lens)
  } catch (error) {
    fatal(
      stripIndent`
          Error while trying to load the ${dimension} dimension of plugin "${plugin.name}":
          
          ${error}
        `
    )
  }
}
