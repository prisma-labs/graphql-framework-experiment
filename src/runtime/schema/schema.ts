import * as NexusLogger from '@nexus/logger'
import * as NexusSchema from '@nexus/schema'
import chalk from 'chalk'
import * as GraphQL from 'graphql'
import * as HTTP from 'http'
import { logPrettyError } from '../../lib/errors'
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
  contextContributors: ContextAdder[]
  plugins: NexusSchema.core.NexusPlugin[]
  scalars: Scalars.Scalars
}

export function createLazyState(): LazyState {
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
export interface Response extends HTTP.ServerResponse {}

export type ContextAdderLens = {
  /**
   * Incoming HTTP request
   */
  req: Request
  /**
   * Server response
   */
  res: Response
}
export type ContextAdder = (params: ContextAdderLens) => MaybePromise<Record<string, unknown>>

type MiddlewareFn = (
  source: any,
  args: any,
  context: NexusSchema.core.GetGen<'context'>,
  info: GraphQL.GraphQLResolveInfo,
  next: GraphQL.GraphQLFieldResolver<any, any>
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
  addToContext(contextAdder: ContextAdder): void
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

export function create(state: AppState): SchemaInternal {
  state.components.schema = createLazyState()
  const statefulNexusSchema = createNexusSchemaStateful()
  const settings = createSchemaSettingsManager()

  const api: Schema = {
    ...statefulNexusSchema.builders,
    use(plugin) {
      assertAppNotAssembled(state, 'app.schema.use', 'The Nexus Schema plugin you used will be ignored.')
      state.components.schema.plugins.push(plugin)
    },
    addToContext(contextAdder) {
      state.components.schema.contextContributors.push(contextAdder)
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
        state.components.schema.contextContributors = []
        state.components.schema.plugins = []
        state.components.schema.scalars = {}
      },
      beforeAssembly() {
        state.components.schema.scalars = statefulNexusSchema.state.scalars
      },
      assemble(plugins) {
        const nexusSchemaConfig = mapSettingsAndPluginsToNexusSchemaConfig(plugins, settings.data)
        nexusSchemaConfig.types.push(...statefulNexusSchema.state.types)
        nexusSchemaConfig.plugins!.push(...state.components.schema.plugins)
        try {
          const { schema, missingTypes } = NexusSchema.core.makeSchemaInternal(nexusSchemaConfig)
          if (process.env.NEXUS_STAGE === 'dev') {
            // Validate GraphQL Schema
            // TODO: This should be done in @nexus/schema
            GraphQL.validate(schema, GraphQL.parse(GraphQL.getIntrospectionQuery()))
          }
          return { schema, missingTypes }
        } catch (err) {
          logPrettyError(log, err, 'fatal')
        }
      },
      checks() {
        assertNoMissingTypesDev(state.assembled!.schema, state.assembled!.missingTypes)

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

      log.error(`Missing type "${chalk.redBright(typeName)}" in your GraphQL Schema.${suggestionsString}`)
    })
  } else {
    Process.fatal(
      `Missing types ${missingTypesNames.map((t) => `"${t}"`).join(', ')} in your GraphQL Schema.`,
      { missingTypesNames }
    )
  }
}
