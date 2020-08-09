import * as NexusSchema from '@nexus/schema'
import * as Settings from '../../lib/settings'
import { Param1 } from '../../lib/utils'

// todo export type from @nexus/schema
type ConnectionPluginConfig = NonNullable<Param1<typeof NexusSchema.connectionPlugin>>

type ConnectionPluginConfigPropsManagedByNexus = 'nexusFieldName' | 'nexusSchemaImportId'

type ConnectionPluginConfigManagedByNexus = Required<
  Pick<ConnectionPluginConfig, ConnectionPluginConfigPropsManagedByNexus>
>

/**
 * Relay connection field builder settings for users.
 */
export type ConnectionSettings = Omit<ConnectionPluginConfig, ConnectionPluginConfigPropsManagedByNexus> & {
  enabled?: boolean
}

export type ConnectionSettingsData = ConnectionSettings & ConnectionPluginConfigManagedByNexus

/**
 * The schema settings users can control.
 */
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
    default?: false | ConnectionSettings
    // Extra undefined below is forced by it being above, forced via `?:`.
    // This is a TS limitation, cannot express void vs missing semantics,
    // being tracked here: https://github.com/microsoft/TypeScript/issues/13195
    [connectionTypeName: string]: false | undefined | ConnectionSettings
  }
  /**
   * Disable or configure the authorization plugin
   */
  authorization?: false | (NexusSchema.core.FieldAuthorizePluginConfig & { enabled?: boolean })
  /**
   * Should a [GraphQL SDL file](https://www.prisma.io/blog/graphql-sdl-schema-definition-language-6755bcb9ce51) be generated when the app is built and to where?
   *
   * A relative path is interpreted as being relative to the project directory.
   *
   * Intermediary folders are created automatically if they do not exist already.
   *
   * @default "api.graphql"
   */
  generateGraphQLSDLFile?: false | string
  /**
   * A glob pattern which will be used to find the files from which to extract the backing types. Backing types are used in/selected in  the rootTyping option of these schema methods:
   *
   * ```
   * schema.objectType
   * schema.interfaceType
   * schema.unionType
   * schema.enumType
   * ```
   *
   * Here is a mini glob syntax guide (copied from [node-glob](https://github.com/isaacs/node-glob#glob-primer)). The following characters have special meaning in path portions:
   *
   * ```
   * * –– Matches 0 or more characters in a single path portion
   *
   * ? –– Matches 1 character
   *
   * [...] –– Matches a range of characters, similar to a RegExp range. If the first character of the range is ! or ^ then it matches any character not in the range.
   *
   * !(pattern|pattern|pattern) –– Matches anything that does not match any of the patterns provided.
   *
   * ?(pattern|pattern|pattern) –– Matches zero or one occurrence of the patterns provided.
   *
   * +(pattern|pattern|pattern) –– Matches one or more occurrences of the patterns provided.
   *
   * *(a|b|c) –– Matches zero or more occurrences of the patterns provided
   *
   * AT_SYMBOL(pattern|pat*|pat?erN) –– Matches exactly one of the patterns provided
   *
   * ** –– If a "globstar" is alone in a path portion, then it matches zero or more directories and subdirectories searching for matches. It does not crawl symlinked directories.
   * ```
   *
   * @default "./**\/*.ts"
   *
   * @example "./**\/*.backing.ts"
   *
   * @remarks
   *
   * The glob library used by Nexus is [minimatch](https://github.com/isaacs/minimatch).
   *
   */
  rootTypingsGlobPattern?: string
}

/**
 * Internal representation of settings data.
 */
export type SettingsData = Omit<Settings.DataDefault<SettingsInput>, 'connections'> & {
  connections: {
    default: ConnectionSettingsData
    [connectionTypeName: string]: ConnectionSettingsData
  }
}

/**
 * Create a schema settings manager.
 *
 * todo make app read .enabled property for connections & authorization
 *
 */
export const createSchemaSettingsManager = () =>
  Settings.create<SettingsInput, SettingsData>({
    fields: {
      nullable: {
        fields: {
          inputs: {
            initial() {
              return true
            },
          },
          outputs: {
            initial() {
              return true
            },
          },
        },
      },
      generateGraphQLSDLFile: {
        initial() {
          return 'api.graphql'
        },
      },
      rootTypingsGlobPattern: {
        initial() {
          return './**/*.ts'
        },
      },
      authorization: {
        // todo update code to read authorizaton.enabled settings data
        shorthand(enabled) {
          return { enabled }
        },
        fields: {
          enabled: {
            initial: () => true,
          },
          formatError: {
            initial: () => defaultAuthorizationErrorFormatter,
          },
        },
      },
      connections: {
        initial() {
          return {
            default: {},
          }
        },
        entryFields: {},
        entryShorthand(disabled) {
          return { enabled: disabled }
        },
        mapEntryData(input, key) {
          return {
            nexusSchemaImportId: 'nexus/components/schema',
            nexusFieldName: key === 'default' ? 'connection' : key,
            ...input,
          }
        },
      },
    },
  })

function defaultAuthorizationErrorFormatter(config: NexusSchema.core.FieldAuthorizePluginErrorConfig) {
  return config.error
}

export type SchemaSettingsManager = ReturnType<typeof createSchemaSettingsManager>
