import * as NexusSchema from '@nexus/schema'
import { Param1 } from '../../lib/utils'
import { createNexusSingleton } from './nexus'

type ConnectionPluginConfig = NonNullable<
  Param1<typeof NexusSchema.connectionPlugin>
>

type ConnectionConfig = Omit<ConnectionPluginConfig, 'nexusFieldName'>

type SettingsInput = {
  /**
   * todo
   */
  connections?: ConnectionConfig & {
    // We tried the idea of types.default: false | ConnectionConfig
    // but got blocked by https://github.com/microsoft/TypeScript/issues/17867

    /**
     * todo
     *
     * @default `false`
     */
    disableDefaultType?: boolean
    /**
     * todo
     */
    types?: {
      default?: ConnectionConfig
      // Extra undefined below is forced by it being above, forced via `?:`.
      // This is a TS limitation, cannot express void vs missing semantics,
      // being tracked here: https://github.com/microsoft/TypeScript/issues/13195
      [typeName: string]: ConnectionConfig | undefined
    }
  }
}

export type Schema = {
  // addToContext: <T extends {}>(
  //   contextContributor: ContextContributor<T>
  // ) => App
  queryType: typeof NexusSchema.queryType
  mutationType: typeof NexusSchema.mutationType
  objectType: typeof NexusSchema.objectType
  inputObjectType: typeof NexusSchema.inputObjectType
  enumType: typeof NexusSchema.enumType
  scalarType: typeof NexusSchema.scalarType
  unionType: typeof NexusSchema.unionType
  interfaceType: typeof NexusSchema.interfaceType
  intArg: typeof NexusSchema.intArg
  stringArg: typeof NexusSchema.stringArg
  booleanArg: typeof NexusSchema.booleanArg
  floatArg: typeof NexusSchema.floatArg
  idArg: typeof NexusSchema.idArg
  extendType: typeof NexusSchema.extendType
  extendInputType: typeof NexusSchema.extendInputType
  settings: (settingsInput: SettingsInput) => void
}

type SchemaInternal = {
  internal: {
    types: any[]
    compile: any
  }
  external: Schema
}

export function create(): SchemaInternal {
  const {
    queryType,
    mutationType,
    objectType,
    inputObjectType,
    enumType,
    scalarType,
    unionType,
    interfaceType,
    intArg,
    stringArg,
    booleanArg,
    floatArg,
    idArg,
    extendType,
    extendInputType,
    makeSchema,
    __types,
  } = createNexusSingleton()

  const state: { settings: SettingsInput } = {
    settings: {},
  }

  return {
    internal: {
      types: __types,
      compile: (c: any) => {
        c.plugins = c.plugins ?? []
        c.plugins.push(...processConnectionsConfig(state.settings))
        return makeSchema(c)
      },
    },
    external: {
      settings(newSettings) {
        if (newSettings.connections) {
          state.settings.connections = state.settings.connections ?? {}
          const { types, ...connectionPluginConfig } = newSettings.connections
          if (types) {
            state.settings.connections.types =
              state.settings.connections.types ?? {}
            Object.assign(state.settings.connections.types, types)
          }
          Object.assign(state.settings.connections, connectionPluginConfig)
        }
      },
      queryType,
      mutationType,
      objectType,
      inputObjectType,
      enumType,
      scalarType,
      unionType,
      interfaceType,
      intArg,
      stringArg,
      booleanArg,
      floatArg,
      idArg,
      extendType,
      extendInputType,
    },
  }
}

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
  const { types, disableDefaultType, ...configBase } = settings.connections
  const { default: defaultTypeConfig, ...customTypes } = types ?? {}

  for (const [name, config] of Object.entries(customTypes)) {
    instances.push(
      NexusSchema.connectionPlugin({
        nexusFieldName: name,
        ...configBase,
        ...config,
      })
    )
  }

  if (disableDefaultType !== true) {
    instances.push(
      defaultConnectionPlugin({ ...configBase, ...defaultTypeConfig })
    )
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
