import * as NexusSchema from '@nexus/schema'
import { stripIndent, stripIndents } from 'common-tags'
import * as fs from 'fs-jetpack'
import * as Lo from 'lodash'
import { isAbsolute } from 'path'
import { mustLoadDataFromParentProcess } from '../../lib/layout/layout'
import * as Plugin from '../../lib/plugin'
import { Param1 } from '../../lib/utils'
import { log } from './logger'
import { SettingsData, SettingsInput } from './schema'

type NexusConfig = NexusSchema.core.SchemaConfig

export const NEXUS_DEFAULT_TYPEGEN_PATH = fs.path(
  'node_modules',
  '@types',
  'typegen-nexus',
  'index.d.ts'
)

export function createNexusSchemaConfig(
  frameworkPlugins: Plugin.RuntimeContributions[],
  settings: SettingsData
): NexusConfig {
  const outputSchemaPath = getOutputSchemaPath(settings)

  const baseConfig: NexusConfig = {
    // todo allow framework user to configure this
    // https://github.com/graphql-nexus/nexus-future/issues/483
    nonNullDefaults: {
      input: true,
      output: false,
    },
    outputs: {
      schema: outputSchemaPath,
      typegen: NEXUS_DEFAULT_TYPEGEN_PATH,
    },
    typegenAutoConfig: {
      sources: [],
    },
    shouldGenerateArtifacts: shouldGenerateArtifacts(),
    shouldExitAfterGenerateArtifacts: shouldExitAfterGenerateArtifacts(),
    types: [],
    plugins: [],
  }

  baseConfig.plugins!.push(...processConnectionsConfig(settings))

  // Merge the plugin nexus plugins
  for (const frameworkPlugin of frameworkPlugins) {
    const schemaPlugins = frameworkPlugin.nexus?.plugins ?? []
    baseConfig.plugins!.push(...schemaPlugins)
  }

  const finalConfig = withAutoTypegenConfig(baseConfig, frameworkPlugins)

  log.trace('config built', { config: finalConfig })

  return finalConfig
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
    const configurator = await NexusSchema.core.typegenAutoConfig(
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

export function shouldGenerateArtifacts(): boolean {
  return process.env.NEXUS_SHOULD_GENERATE_ARTIFACTS === 'true'
    ? true
    : process.env.NEXUS_SHOULD_GENERATE_ARTIFACTS === 'false'
    ? false
    : Boolean(!process.env.NODE_ENV || process.env.NODE_ENV === 'development')
}

export function shouldExitAfterGenerateArtifacts(): boolean {
  return process.env.NEXUS_SHOULD_EXIT_AFTER_GENERATE_ARTIFACTS === 'true'
    ? true
    : false
}

type ConnectionPluginConfig = NonNullable<
  Param1<typeof NexusSchema.connectionPlugin>
>

export type ConnectionConfig = Omit<ConnectionPluginConfig, 'nexusFieldName'>

/**
 * Process the schema connection settings into nexus schema relay connection
 * plugins.
 */
function processConnectionsConfig(
  settings: SettingsInput
): NexusSchema.core.NexusPlugin[] {
  if (settings.connections === undefined) {
    return [defaultConnectionPlugin({})]
  }

  const instances: NexusSchema.core.NexusPlugin[] = []
  const {
    default: defaultTypeConfig,
    ...customTypesConfig
  } = settings.connections

  for (const [name, config] of Object.entries(customTypesConfig)) {
    if (config) {
      instances.push(
        NexusSchema.connectionPlugin({
          nexusFieldName: name,
          ...config,
        })
      )
    }
  }

  if (defaultTypeConfig) {
    instances.push(defaultConnectionPlugin(defaultTypeConfig))
  }

  return instances
}

function defaultConnectionPlugin(
  configBase: ConnectionConfig
): NexusSchema.core.NexusPlugin {
  return NexusSchema.connectionPlugin({
    ...configBase,
    nexusFieldName: 'connection',
  })
}

function getOutputSchemaPath(settings: SettingsInput) {
  if (process.env.NEXUS_STAGE !== 'dev') {
    return false
  }

  const layout = mustLoadDataFromParentProcess() // Using layout at runtime and in "prod"
  // Process graphQL SDL output setting
  let outputSchema: string | false

  if (
    settings.generateGraphQLSDLFile === undefined ||
    settings.generateGraphQLSDLFile === false
  ) {
    outputSchema = false
  } else {
    if (isAbsolute(settings.generateGraphQLSDLFile)) {
      outputSchema = settings.generateGraphQLSDLFile
    } else {
      outputSchema = layout.projectPath(settings.generateGraphQLSDLFile)
    }
  }

  return outputSchema
}
