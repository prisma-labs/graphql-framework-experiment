import * as NexusLogger from '@nexus/logger'
import * as NexusSchema from '@nexus/schema'
import chalk from 'chalk'
import { GraphQLFieldResolver, GraphQLResolveInfo } from 'graphql'
import * as HTTP from 'http'
import { createNexusSchemaStateful, NexusSchemaStatefulBuilders } from '../../lib/nexus-schema-stateful'
import { RuntimeContributions } from '../../lib/plugin'
import * as Process from '../../lib/process'
import * as Scalars from '../../lib/scalars'
import { Index, MaybePromise } from '../../lib/utils'
import { AppState } from '../app'
import * as DevMode from '../dev-mode'
import { assertAppNotAssembled } from '../utils'
import { log } from './logger'
import { createSchemaSettingsManager, SchemaSettingsManager } from './settings'
import { mapSettingsAndPluginsToNexusSchemaConfig } from './settings-mapper'

export type LazyState = {
  contextContributors: ContextContributor[]
  plugins: NexusSchema.core.NexusPlugin[]
  scalars: Scalars.Scalars
}

function createLazyState(): LazyState {
  return {
    contextContributors: [],
    plugins: [],
    scalars: {},
  }
}

// Export this so that context typegen can import it, for example if users do
// this:
//
//    schema.addToContext(req => ({ req }))
//
// todo seems very brittle
// todo request being exposed on context should be done by the framework
export interface Request extends HTTP.IncomingMessage {
  log: NexusLogger.Logger
}

export type ContextContributor = (req: Request) => MaybePromise<Record<string, unknown>>

type MiddlewareFn = (
  source: any,
  args: any,
  context: NexusSchema.core.GetGen<'context'>,
  info: GraphQLResolveInfo,
  next: GraphQLFieldResolver<any, any>
) => any

/**
 * Schema component API
 */
export interface Schema extends NexusSchemaStatefulBuilders {
  /**
   * todo link to website docs
   */
  use(schemaPlugin: NexusSchema.core.NexusPlugin): void
  /**
   * todo link to website docs
   */
  middleware(fn: (config: NexusSchema.core.CreateFieldResolverInfo) => MiddlewareFn | undefined): void
  /**
   * todo link to website docs
   */
  addToContext(contextContributor: ContextContributor): void
}

/**
 * Schema component internal API
 */
export interface SchemaInternal {
  private: {
    settings: SchemaSettingsManager
    checks(): void
    assemble(
      plugins: RuntimeContributions[]
    ): { schema: NexusSchema.core.NexusGraphQLSchema; missingTypes: Index<NexusSchema.core.MissingType> }
    beforeAssembly(): void
    reset(): void
  }
  public: Schema
}

export function create(appState: AppState): SchemaInternal {
  appState.schemaComponent = createLazyState()
  const statefulNexusSchema = createNexusSchemaStateful()
  const settings = createSchemaSettingsManager()

  const api: Schema = {
    ...statefulNexusSchema.builders,
    use(plugin) {
      assertAppNotAssembled(appState, 'app.schema.use', 'The Nexus Schema plugin you used will be ignored.')
      appState.schemaComponent.plugins.push(plugin)
    },
    addToContext(contextContributor) {
      appState.schemaComponent.contextContributors.push(contextContributor)
    },
    middleware(fn) {
      api.use(
        NexusSchema.plugin({
          // TODO: Do we need to expose the name property?
          name: 'local-middleware',
          onCreateFieldResolver(config) {
            return fn(config)
          },
        })
      )
    },
  }

  return {
    public: api,
    private: {
      settings: settings,
      reset() {
        statefulNexusSchema.state.types = []
        statefulNexusSchema.state.scalars = {}
        appState.schemaComponent.contextContributors = []
        appState.schemaComponent.plugins = []
        appState.schemaComponent.scalars = {}
      },
      beforeAssembly() {
        appState.schemaComponent.scalars = statefulNexusSchema.state.scalars
      },
      assemble(plugins) {
        const nexusSchemaConfig = mapSettingsAndPluginsToNexusSchemaConfig(plugins, settings.data)
        nexusSchemaConfig.types.push(...statefulNexusSchema.state.types)
        nexusSchemaConfig.plugins!.push(...appState.schemaComponent.plugins)
        const { schema, missingTypes } = NexusSchema.core.makeSchemaInternal(nexusSchemaConfig)
        return { schema, missingTypes }
      },
      checks() {
        assertNoMissingTypesDev(appState.assembled!.schema, appState.assembled!.missingTypes)

        // TODO: We should separate types added by the framework and the ones added by users
        if (
          statefulNexusSchema.state.types.length === 2 &&
          statefulNexusSchema.state.types.every(
            (t) => (Scalars.builtinScalars as Scalars.Scalars)[t.name] !== undefined
          )
        ) {
          log.warn(emptyExceptionMessage())
        }
      },
    },
  }
}

function emptyExceptionMessage() {
  return `Your GraphQL schema is empty. This is normal if you have not defined any GraphQL types yet. If you did however, check that your files are contained in the same directory specified in the \`rootDir\` property of your tsconfig.json file.`
}

function assertNoMissingTypesDev(
  schema: NexusSchema.core.NexusGraphQLSchema,
  missingTypes: Index<NexusSchema.core.MissingType>
) {
  const missingTypesNames = Object.keys(missingTypes)

  if (missingTypesNames.length === 0) {
    return
  }

  const schemaTypeMap = schema.getTypeMap()
  const schemaTypeNames = Object.keys(schemaTypeMap).filter(
    (typeName) => !NexusSchema.core.isUnknownType(schemaTypeMap[typeName])
  )

  if (DevMode.isDevMode()) {
    missingTypesNames.map((typeName) => {
      const suggestions = NexusSchema.core.suggestionList(typeName, schemaTypeNames)

      let suggestionsString = ''

      if (suggestions.length > 0) {
        suggestionsString = ` Did you mean ${suggestions
          .map((s) => `"${chalk.greenBright(s)}"`)
          .join(', ')} ?`
      }

      log.error(`Missing type "${chalk.greenBright(typeName)}" in your GraphQL Schema.${suggestionsString}`)
    })
  } else {
    Process.fatal(
      `Missing types ${missingTypesNames.map((t) => `"${t}"`).join(', ')} in your GraphQL Schema.`,
      { missingTypesNames }
    )
  }
}
