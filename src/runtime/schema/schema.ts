import * as Logger from '@nexus/logger'
import * as NexusSchema from '@nexus/schema'
import {
  CreateFieldResolverInfo,
  makeSchemaInternal,
  MissingType,
  NexusGraphQLSchema,
} from '@nexus/schema/dist/core'
import { GraphQLFieldResolver, GraphQLResolveInfo } from 'graphql'
import * as HTTP from 'http'
import * as Layout from '../../lib/layout'
import { createNexusSchemaStateful, NexusSchemaStatefulBuilders } from '../../lib/nexus-schema-stateful'
import { RuntimeContributions } from '../../lib/plugin'
import { Index, MaybePromise } from '../../lib/utils'
import { AppState } from '../app'
import { assertAppNotAssembled } from '../utils'
import { log } from './logger'
import {
  createSchemaSettingsManager,
  mapSettingsToNexusSchemaConfig,
  SchemaSettingsManager,
} from './settings'

export type LazyState = {
  contextContributors: ContextContributor[]
  plugins: NexusSchema.core.NexusPlugin[]
}

function createLazyState(): LazyState {
  return {
    contextContributors: [],
    plugins: [],
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
  log: Logger.Logger
}

export type ContextContributor = (req: Request) => MaybePromise<Record<string, unknown>>

type MiddlewareFn = (
  source: any,
  args: any,
  context: NexusSchema.core.GetGen<'context'>,
  info: GraphQLResolveInfo,
  next: GraphQLFieldResolver<any, any>
) => any

export interface Schema extends NexusSchemaStatefulBuilders {
  /**
   * todo link to website docs
   */
  use(schemaPlugin: NexusSchema.core.NexusPlugin): void
  /**
   * todo link to website docs
   */
  middleware(fn: (config: CreateFieldResolverInfo) => MiddlewareFn | undefined): void
  /**
   * todo link to website docs
   */
  addToContext(contextContributor: ContextContributor): void
}

export interface SchemaInternal {
  private: {
    settings: SchemaSettingsManager
    checks(): void
    assemble(
      plugins: RuntimeContributions[]
    ): { schema: NexusGraphQLSchema; missingTypes: Index<MissingType> }
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
      assemble: (plugins) => {
        const nexusSchemaConfig = mapSettingsToNexusSchemaConfig(plugins, settings.data)
        nexusSchemaConfig.types.push(...statefulNexusSchema.state.types)
        nexusSchemaConfig.plugins!.push(...appState.schemaComponent.plugins)
        const { schema, missingTypes } = makeSchemaInternal(nexusSchemaConfig)
        return { schema, missingTypes }
      },
      checks() {
        NexusSchema.core.assertNoMissingTypes(appState.assembled!.schema, appState.assembled!.missingTypes)
        if (statefulNexusSchema.state.types.length === 0) {
          log.warn(Layout.schema.emptyExceptionMessage())
        }
      },
    },
  }
}
