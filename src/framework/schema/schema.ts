import * as NexusSchema from '@nexus/schema'
import { NexusGraphQLSchema } from '@nexus/schema/dist/core'
import { RuntimeContributions } from '../../lib/plugin'
import { ConnectionConfig, createNexusSchemaConfig } from './config'
import { createNexusSingleton } from './nexus'

export type SettingsInput = {
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
}

export type SettingsData = SettingsInput

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
  arg: typeof NexusSchema.arg
  intArg: typeof NexusSchema.intArg
  stringArg: typeof NexusSchema.stringArg
  booleanArg: typeof NexusSchema.booleanArg
  floatArg: typeof NexusSchema.floatArg
  idArg: typeof NexusSchema.idArg
  extendType: typeof NexusSchema.extendType
  extendInputType: typeof NexusSchema.extendInputType
}

type SchemaInternal = {
  private: {
    isSchemaEmpty(): boolean
    makeSchema: () => Promise<NexusGraphQLSchema>
    settings: {
      data: SettingsData
      change: (newSettings: SettingsInput) => void
    }
  }
  public: Schema
}

export function create({
  plugins,
}: {
  plugins: RuntimeContributions[]
}): SchemaInternal {
  const {
    queryType,
    mutationType,
    objectType,
    inputObjectType,
    enumType,
    scalarType,
    unionType,
    interfaceType,
    arg,
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

  type State = {
    settings: SettingsData
  }

  const state: State = {
    settings: {},
  }

  const api: SchemaInternal = {
    private: {
      isSchemaEmpty: () => {
        return __types.length === 0
      },
      makeSchema: () => {
        const nexusSchemaConfig = createNexusSchemaConfig(
          plugins,
          state.settings
        )
        const schema = makeSchema(nexusSchemaConfig)
        return schema
      },
      settings: {
        data: state.settings,
        change(newSettings) {
          if (newSettings.generateGraphQLSDLFile) {
            state.settings.generateGraphQLSDLFile =
              newSettings.generateGraphQLSDLFile
          }

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
      },
    },
    public: {
      queryType,
      mutationType,
      objectType,
      inputObjectType,
      enumType,
      scalarType,
      unionType,
      interfaceType,
      arg,
      intArg,
      stringArg,
      booleanArg,
      floatArg,
      idArg,
      extendType,
      extendInputType,
    },
  }

  return api
}
