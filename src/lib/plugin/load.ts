import { stripIndent } from 'common-tags'
import prompts from 'prompts'
import * as Layout from '../../lib/layout'
import { rootLogger } from '../nexus-logger'
import { fatal, run, runSync } from '../process'
import { importAllPlugins, importAllPluginsSync, Plugin } from './import'
import {
  Lens,
  RuntimeContributions,
  TesttimeContributions,
  WorktimeHooks,
} from './index'

type Dimension = 'worktime' | 'runtime' | 'testtime'

const log = rootLogger.child('plugin')

function createLens(pluginName: string): Lens {
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
export async function loadAllWorktimePlugins(
  layout: Layout.Layout
): Promise<{ name: string; hooks: WorktimeHooks }[]> {
  const plugins = await importAllPlugins()
  const worktimePlugins = plugins.filter(plugin => plugin.worktime)
  const workflowHooks = worktimePlugins.map(plugin => {
    const lens: any = createLens(plugin.name)
    lens.layout = layout
    lens.packageManager = layout.packageManager
    const hooks: WorktimeHooks = {
      create: {},
      dev: {
        addToWatcherSettings: {},
      },
      build: {},
      generate: {},
    }

    loadPlugin('worktime', plugin, [hooks, lens])

    return {
      name: plugin.name,
      hooks: hooks,
    }
  })

  return workflowHooks
}

/**
 * Load all runtime plugins that are installed into the project.
 */
export async function loadAllRuntimePlugins(): Promise<RuntimeContributions[]> {
  const plugins = await importAllPlugins()
  return __loadAllRuntimePlugins(plugins)
}

/**
 * Load all runtime plugins that are installed into the project.
 */
export function loadAllRuntimePluginsSync(): RuntimeContributions[] {
  const plugins = importAllPluginsSync()
  return __loadAllRuntimePlugins(plugins)
}

/**
 * Logic shared between sync/async variants.
 */
function __loadAllRuntimePlugins(plugins: Plugin[]): RuntimeContributions[] {
  return plugins
    .filter(plugin => plugin.runtime)
    .map(plugin => {
      return loadPlugin('runtime', plugin, [createLens(plugin.name)])
    })
}

export async function loadAllTesttimePlugins(): Promise<
  TesttimeContributions[]
> {
  const plugins = await importAllPlugins()

  return plugins
    .filter(plugin => plugin.testtime)
    .map(plugin => {
      return loadPlugin('testtime', plugin, [createLens(plugin.name)])
    })
}

/**
 * Try to load the given dimension of the given plugin.
 */
function loadPlugin<D extends Dimension, P extends Plugin>(
  dimension: D,
  plugin: P,
  args: any[]
): ReturnType<NonNullable<P[D]>> {
  log.trace('load', { dimension: dimension, plugin: plugin.name })
  try {
    const dim: any = plugin[dimension]
    return dim(...args)
  } catch (error) {
    fatal(
      stripIndent`
          Error while trying to load the ${dimension} dimension of plugin "${plugin.name}":
          
          ${error}
        `
    )
  }
}
