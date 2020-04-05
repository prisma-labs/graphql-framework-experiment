import { stripIndent } from 'common-tags'
import { PackageJson } from 'type-fest'
import { RuntimePlugin, TesttimePlugin, WorktimePlugin } from '.'
import * as Layout from '../layout/layout'
import { rootLogger } from '../nexus-logger'
import { fatal } from '../process'
import { requireModule } from '../utils'

const log = rootLogger.child('plugin-manager')

export interface Plugin {
  name: string
  worktime?: WorktimePlugin
  runtime?: RuntimePlugin
  testtime?: TesttimePlugin
}

/**
 *
 */
export async function getInstalledRuntimePluginNames(
  layout: Layout.Layout
): Promise<string[]> {
  const pluginDepNames = extractPluginNames(layout.packageJson?.content ?? null)
  const runtimePluginDepNames = pluginDepNames.filter((depName) => {
    return (
      null !==
      requireModule({ depName: depName + '/dist/runtime', optional: true })
    )
  })
  const runtimePluginNames = runtimePluginDepNames.map(
    (x) => parsePluginName(x)!
  )
  return runtimePluginNames
}

/**
 * Load all nexus plugins installed into the project
 */
export async function importAllPlugins(
  layout: Layout.Layout
): Promise<Plugin[]> {
  const plugins = doImportAllPlugins(layout.packageJson?.content ?? null)
  return plugins
}

/**
 * Logic shared between sync/async variants.
 */
function doImportAllPlugins(packageJson: null | PackageJson): Plugin[] {
  const pluginDepNames = extractPluginNames(packageJson)

  if (!packageJson) {
    log.trace(
      'We could not find any package.json file. No plugin will be loaded.'
    )
  } else {
    log.trace('Extracting plugins from package.json', {
      content: packageJson,
      pluginDepNames: pluginDepNames,
    })
  }

  const plugins = pluginDepNames.map((depName) => {
    const pluginName = parsePluginName(depName)! // guaranteed by extract above
    let plugin: Plugin = {
      name: pluginName,
    }
    try {
      //prettier-ignore
      plugin.testtime = (requireModule({ depName: depName + '/dist/testtime', optional: true }) as any)?.plugin
      //prettier-ignore
      plugin.worktime = (requireModule({ depName: depName + '/dist/worktime', optional: true }) as any)?.plugin
      //prettier-ignore
      plugin.runtime = (requireModule({ depName: depName + '/dist/runtime', optional: true }) as any)?.plugin
    } catch (error) {
      fatal(
        stripIndent`
          An error occured while importing the Nexus plugin "${pluginName}":

          ${error}
        `
      )
    }

    return plugin
  })

  return plugins
}

/**
 * Parse a nexus plugin package name to just the plugin name.
 */
export function parsePluginName(packageName: string): null | string {
  const matchResult = packageName.match(/^nexus-plugin-(.+)/)

  if (matchResult === null) return null

  const pluginName = matchResult[1]

  return pluginName
}

/**
 *
 */
export function extractPluginNames(packageJson: null | PackageJson): string[] {
  const deps = packageJson?.dependencies ?? {}
  const depNames = Object.keys(deps)
  const pluginDepNames = depNames.filter((depName) =>
    depName.match(/^nexus-plugin-.+/)
  )
  return pluginDepNames
}
