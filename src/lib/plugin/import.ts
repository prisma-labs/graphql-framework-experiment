import { stripIndent } from 'common-tags'
import * as fs from 'fs-jetpack'
import * as Path from 'path'
import { PackageJson } from 'type-fest'
import { RuntimePlugin, TesttimePlugin, WorktimePlugin } from '.'
import { rootLogger } from '../nexus-logger'
import { fatal } from '../process'
import { getProjectRoot } from '../project-root'
import { requireModule } from '../utils'

const log = rootLogger.child('plugin-manager')

export interface Plugin {
  name: string
  worktime?: WorktimePlugin
  runtime?: RuntimePlugin
  testtime?: TesttimePlugin
}

/**
 * Load all nexus plugins installed into the project
 */
export async function importAllPlugins(): Promise<Plugin[]> {
  const packageJsonPath = Path.join(getProjectRoot(), 'package.json')
  const packageJson: undefined | Record<string, any> = await fs.readAsync(
    packageJsonPath,
    'json'
  )

  return __importAllPlugins(packageJsonPath, packageJson)
}

/**
 * Load all nexus plugins installed into the project
 * TODO: /!\ This should not be called in production
 */
export function importAllPluginsSync(): Plugin[] {
  const packageJsonPath = Path.join(getProjectRoot(), 'package.json')
  const packageJson: undefined | Record<string, any> = fs.read(
    packageJsonPath,
    'json'
  )

  return __importAllPlugins(packageJsonPath, packageJson)
}

/**
 * Logic shared between sync/async variants.
 */
function __importAllPlugins(
  packageJsonPath: string,
  packageJson?: PackageJson
): Plugin[] {
  if (!packageJson) {
    log.trace(
      'We could not find any package.json file. No plugin will be loaded.',
      { packageJsonPath }
    )
  } else {
    log.trace('Extracting plugins from package.json', {
      path: packageJsonPath,
      content: packageJson,
    })
  }

  const deps = packageJson?.dependencies ?? {}
  const depNames = Object.keys(deps)
  const pluginDepNames = depNames.filter(depName =>
    depName.match(/^nexus-plugin-.+/)
  )
  const plugins: Plugin[] = pluginDepNames.map(depName => {
    const pluginName = parsePluginName(depName)! // filter above guarantees

    let plugin: Plugin = {
      name: pluginName,
    }
    try {
      plugin.testtime = requireModule({
        depName: pluginName + './testtime',
        optional: true,
      }) as any
      plugin.worktime = requireModule({
        depName: pluginName + './worktime',
        optional: true,
      }) as any
      plugin.runtime = requireModule({
        depName: pluginName + './runtime',
        optional: true,
      }) as any
    } catch (error) {
      fatal(
        stripIndent`
        An error occured while importing the plugin ${pluginName}:

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
