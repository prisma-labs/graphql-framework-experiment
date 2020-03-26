import * as NexusSchema from '@nexus/schema'
import * as Layout from '../../lib/layout'
import { RuntimeContributions } from '../../lib/plugin'
import { ConnectionConfig, createNexusSchemaConfig } from './config'
import { createNexusSingleton } from './nexus'
import { writeTypegen } from './utils'

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

export type Schema = {
  // addToContext: <T extends {}>(
  //   contextContributor: ContextContributor<T>
  // ) => App
  queryType: typeof NexusSchema.queryType
  mutationType: typeof NexusSchema.mutationType
  objectType: ReturnType<typeof createNexusSingleton>['objectType']
  enumType: ReturnType<typeof createNexusSingleton>['enumType']
  scalarType: ReturnType<typeof createNexusSingleton>['scalarType']
  unionType: ReturnType<typeof createNexusSingleton>['unionType']
  interfaceType: ReturnType<typeof createNexusSingleton>['interfaceType']
  inputObjectType: typeof NexusSchema.inputObjectType
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
    makeSchema: () => Promise<NexusSchema.core.NexusGraphQLSchema>
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
      makeSchema: async () => {
        const nexusSchemaConfig = createNexusSchemaConfig(
          plugins,
          state.settings
        )
        const { schema, missingTypes, typegenConfig } = await makeSchema(
          nexusSchemaConfig
        )
        if (nexusSchemaConfig.shouldGenerateArtifacts === true) {
          const devModeLayout = await Layout.loadDataFromParentProcess()

          if (!devModeLayout) {
            throw new Error(
              'Layout should be defined when should gen artifacts is true. This should not happen.'
            )
          }

          const typegenPromise = writeTypegen(
            schema,
            typegenConfig,
            state.settings.rootTypingsGlobPattern,
            devModeLayout
          )

          // Await promise only if needed. Otherwise let it run in the background
          if (process.env.NEXUS_SHOULD_AWAIT_TYPEGEN === 'true') {
            await typegenPromise
          }

          if (nexusSchemaConfig.shouldExitAfterGenerateArtifacts) {
            process.exit(0)
          }
        }

        /**
         * Assert that there are no missing types after running typegen only
         * so that we don't block writing the typegen when eg: renaming types
         */
        NexusSchema.core.assertNoMissingTypes(schema, missingTypes)

        return schema
      },
      settings: {
        data: state.settings,
        change(newSettings) {
          if (newSettings.generateGraphQLSDLFile) {
            state.settings.generateGraphQLSDLFile =
              newSettings.generateGraphQLSDLFile
          }

          if (newSettings.rootTypingsGlobPattern) {
            state.settings.rootTypingsGlobPattern =
              newSettings.rootTypingsGlobPattern
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
