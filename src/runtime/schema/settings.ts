import * as NexusSchema from '@nexus/schema'
import * as Lo from 'lodash'
import * as Plugin from '../../lib/plugin'
import { Param1 } from '../../lib/utils'
import { log as schemaLogger } from './logger'

const log = schemaLogger.child('settings')

type NexusSchemaConfig = NexusSchema.core.SchemaConfig

export type SettingsInput = {
  /**
   *  See the [Nullability Guide](https://www.nexusjs.org/#/guides/schema?id=nullability-in-principal) for more details.
   */
  nullable?: {
    /**
     * Should passing arguments be optional for clients by default?
     *
     * @default true
     */
    inputs?: boolean
    /**
     * Should the data requested by clients _not_ be guaranteed to be returned by default?
     *
     * @default true
     */
    outputs?: boolean
  }
  /**
   * todo
   */
  connections?: {
    /**
     * todo
     */
    default?: ConnectionConfig | false
    // Extra undefined below is forced by it being above, forced via `?:`.
    // This is a TS limitation, cannot express void vs missing semantics,
    // being tracked here: https://github.com/microsoft/TypeScript/issues/13195
    [typeName: string]: ConnectionConfig | undefined | false
  }
  /**
   * Should a [GraphQL SDL file](https://www.prisma.io/blog/graphql-sdl-schema-definition-language-6755bcb9ce51) be generated when the app is built and to where?
   *
   * A relative path is interpreted as being relative to the project directory.
   * Intermediary folders are created automatically if they do not exist
   * already.
   *
   * @default false
   */
  generateGraphQLSDLFile?: false | string
  /**
   * A glob pattern which will be used to find the files from which to extract the backing types used in the `rootTyping` option of `schema.(objectType|interfaceType|unionType|enumType)`
   *
   * @default "./**\/*.ts"
   *
   * @example "./**\/*.backing.ts"
   */
  rootTypingsGlobPattern?: string
}

export type SettingsData = SettingsInput

export function changeSettings(state: SettingsData, newSettings: SettingsInput) {
  if (newSettings.nullable) {
    if (state.nullable === undefined) {
      state.nullable = {}
    }
    Lo.merge(state.nullable, newSettings.nullable)
  }

  if (newSettings.generateGraphQLSDLFile) {
    state.generateGraphQLSDLFile = newSettings.generateGraphQLSDLFile
  }

  if (newSettings.rootTypingsGlobPattern) {
    state.rootTypingsGlobPattern = newSettings.rootTypingsGlobPattern
  }

  if (newSettings.connections) {
    state.connections = state.connections ?? {}
    const { types, ...connectionPluginConfig } = newSettings.connections
    if (types) {
      state.connections.types = state.connections.types ?? {}
      Object.assign(state.connections.types, types)
    }
    Object.assign(state.connections, connectionPluginConfig)
  }
}

export function mapSettingsToNexusSchemaConfig(
  frameworkPlugins: Plugin.RuntimeContributions[],
  settings: SettingsData
): NexusSchemaConfig {
  const runtimeTypegenConfig = {
    // Always false here, then set to true in the reflection module
    outputs: false,
    shouldGenerateArtifacts: false,
    shouldExitAfterGenerateArtifacts: false,
  }

  const baseConfig: NexusSchemaConfig = {
    nonNullDefaults: {
      input: !(settings?.nullable?.inputs ?? true),
      output: !(settings?.nullable?.outputs ?? true),
    },
    typegenAutoConfig: {
      sources: [],
    },
    types: [],
    plugins: [],
    ...runtimeTypegenConfig,
  }

  baseConfig.plugins!.push(...processConnectionsConfig(settings))

  // Merge the plugin nexus plugins
  for (const frameworkPlugin of frameworkPlugins) {
    const schemaPlugins = frameworkPlugin.schema?.plugins ?? []
    baseConfig.plugins!.push(...schemaPlugins)
  }

  log.trace('config built', { config: baseConfig })

  return baseConfig
}

type ConnectionPluginConfig = NonNullable<Param1<typeof NexusSchema.connectionPlugin>>

export type ConnectionConfig = Omit<ConnectionPluginConfig, 'nexusFieldName'>

/**
 * Process the schema connection settings into nexus schema relay connection
 * plugins.
 */
function processConnectionsConfig(settings: SettingsInput): NexusSchema.core.NexusPlugin[] {
  if (settings.connections === undefined) {
    return [
      defaultConnectionPlugin({
        nexusSchemaImportId: 'nexus/components/schema',
      }),
    ]
  }

  const instances: NexusSchema.core.NexusPlugin[] = []

  const { default: defaultTypeConfig, ...customTypesConfig } = settings.connections

  for (const [name, config] of Object.entries(customTypesConfig)) {
    if (config) {
      instances.push(
        NexusSchema.connectionPlugin({
          nexusSchemaImportId: 'nexus/components/schema',
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

function defaultConnectionPlugin(configBase: ConnectionConfig): NexusSchema.core.NexusPlugin {
  return NexusSchema.connectionPlugin({
    ...configBase,
    nexusFieldName: 'connection',
  })
}

function defaultSettings(): SettingsInput {
  return {}
}

export function createSchemaSettingsManager() {
  const data = defaultSettings()
  const change = (newSettings: SettingsInput) => {
    return changeSettings(data, newSettings)
  }

  return {
    change,
    data,
  }
}

export type SchemaSettingsManager = ReturnType<typeof createSchemaSettingsManager>
