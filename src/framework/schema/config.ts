import * as Nexus from '@nexus/schema'
import { stripIndent, stripIndents } from 'common-tags'
import * as fs from 'fs-jetpack'
import * as Lo from 'lodash'
import * as Plugin from '../../lib/plugin'
import { log } from './logger'
import {
  shouldExitAfterGenerateArtifacts,
  shouldGenerateArtifacts,
} from './nexus'

export type NexusConfig = Nexus.core.SchemaConfig
export const NEXUS_DEFAULT_TYPEGEN_PATH = fs.path(
  'node_modules',
  '@types',
  'typegen-nexus',
  'index.d.ts'
)
export const NEXUS_DEFAULT_RUNTIME_CONTEXT_TYPEGEN_PATH = fs.path(
  'node_modules',
  '@types',
  'typegen-nexus-context',
  'index.d.ts'
)

export function createInternalConfig(
  plugins: Plugin.RuntimeContributions[]
): NexusConfig {
  const defaultConfig = createDefaultNexusConfig()

  // Merge the plugin nexus plugins
  defaultConfig.plugins = defaultConfig.plugins ?? []

  for (const plugin of plugins) {
    defaultConfig.plugins.push(...(plugin.nexus?.plugins ?? []))
  }

  const finalConfig = withAutoTypegenConfig(defaultConfig, plugins)

  log.trace('config built', { nexusConfig: finalConfig })

  return finalConfig
}

function createDefaultNexusConfig(): NexusConfig {
  return {
    outputs: {
      schema: fs.path('generated', 'schema.graphql'),
      typegen: NEXUS_DEFAULT_TYPEGEN_PATH,
    },
    typegenAutoConfig: {
      sources: [],
    },
    shouldGenerateArtifacts: shouldGenerateArtifacts(),
    shouldExitAfterGenerateArtifacts: shouldExitAfterGenerateArtifacts(),
    types: [],
  }
}

function withAutoTypegenConfig(
  nexusConfig: NexusConfig,
  plugins: Plugin.RuntimeContributions[]
) {
  // Integrate plugin typegenAutoConfig contributions
  const typegenAutoConfigFromPlugins = {}
  for (const p of plugins) {
    if (p.nexus?.typegenAutoConfig) {
      Lo.merge(typegenAutoConfigFromPlugins, p.nexus.typegenAutoConfig)
    }
  }

  const typegenAutoConfigObject = Lo.merge(
    {},
    typegenAutoConfigFromPlugins,
    nexusConfig.typegenAutoConfig!
  )
  nexusConfig.typegenAutoConfig = undefined

  function contextTypeContribSpecToCode(
    ctxTypeContribSpec: Record<string, string>
  ): string {
    return stripIndents`
      interface Context {
        ${Object.entries(ctxTypeContribSpec)
          .map(([name, type]) => {
            // Quote key name to handle case of identifier-incompatible key names
            return `'${name}': ${type}`
          })
          .join('\n')}
      }
    `
  }

  // Our use-case of multiple context sources seems to require a custom
  // handling of typegenConfig. Opened an issue about maybe making our
  // curreent use-case, fairly basic, integrated into the auto system, here:
  // https://github.com/prisma-labs/nexus/issues/323
  nexusConfig.typegenConfig = async (schema, outputPath) => {
    const configurator = await Nexus.core.typegenAutoConfig(
      typegenAutoConfigObject
    )
    const config = await configurator(schema, outputPath)

    // Initialize
    config.imports.push('interface Context {}')
    config.imports.push(stripIndent`
      declare global {
        interface NexusContext extends Context {}
      }
    `)
    config.contextType = 'NexusContext'

    // Integrate plugin context contributions
    for (const p of plugins) {
      if (!p.context) continue

      if (p.context.typeGen.imports) {
        config.imports.push(
          ...p.context.typeGen.imports.map(
            im => `import * as ${im.as} from '${im.from}'`
          )
        )
      }

      config.imports.push(
        contextTypeContribSpecToCode(p.context.typeGen.fields)
      )
    }

    config.imports.push(
      "import * as Logger from 'nexus-future/dist/lib/logger'",
      contextTypeContribSpecToCode({
        log: 'Logger.Logger',
      })
    )

    log.trace('built up Nexus typegenConfig', { config })
    return config
  }

  return nexusConfig
}
