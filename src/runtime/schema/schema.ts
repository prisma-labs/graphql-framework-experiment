import * as Logger from '@nexus/logger'
import * as NexusSchema from '@nexus/schema'
import { CreateFieldResolverInfo, makeSchemaInternal } from '@nexus/schema/dist/core'
import { stripIndent } from 'common-tags'
import { GraphQLFieldResolver, GraphQLResolveInfo } from 'graphql'
import * as HTTP from 'http'
import * as Layout from '../../lib/layout'
import { createNexusSchemaStateful, NexusSchemaStatefulBuilders } from '../../lib/nexus-schema-stateful'
import { RuntimeContributions } from '../../lib/plugin'
import { MaybePromise } from '../../lib/utils'
import { AppState } from '../app'
import { log } from './logger'
import {
  createSchemaSettingsManager,
  mapSettingsToNexusSchemaConfig,
  SchemaSettingsManager,
} from './settings'

export type LazyState = {
  contextContributors: ContextContributor[]
  plugins: NexusSchema.core.NexusPlugin[]
  /**
   * GraphQL schema built by @nexus/schema
   *
   * @remarks
   *
   * Only available after assembly
   */
  schema: null | NexusSchema.core.NexusGraphQLSchema
  /**
   * @remarks
   *
   * Only available after assembly
   */
  missingTypes: null | Record<string, NexusSchema.core.MissingType>
}

function createLazyState(): LazyState {
  return {
    contextContributors: [],
    plugins: [],
    schema: null,
    missingTypes: null,
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
    assemble(plugins: RuntimeContributions[]): void
  }
  public: Schema
}

export function create(appState: AppState): SchemaInternal {
  appState.schemaComponent = createLazyState()
  const statefulNexusSchema = createNexusSchemaStateful()
  const settings = createSchemaSettingsManager()

  const middleware: SchemaInternal['public']['middleware'] = (fn) => {
    api.public.use(
      NexusSchema.plugin({
        // TODO: Do we need to expose the name property?
        name: 'local-middleware',
        onCreateFieldResolver(config) {
          return fn(config)
        },
      })
    )
  }

  const api: SchemaInternal = {
    public: {
      ...statefulNexusSchema.builders,
      use(plugin) {
        if (appState.assembled === true) {
          log.warn(stripIndent`
            A Nexus Schema plugin was ignored because it was loaded after the server was started
            Make sure to call \`schema.use\` before you call \`server.start\`
          `)
        }

        appState.schemaComponent.plugins.push(plugin)
      },
      addToContext(contextContributor) {
        appState.schemaComponent.contextContributors.push(contextContributor)
      },
      middleware,
    },
    private: {
      settings: settings,
      checks() {
        NexusSchema.core.assertNoMissingTypes(
          appState.schemaComponent.schema!,
          appState.schemaComponent.missingTypes!
        )

        if (statefulNexusSchema.state.types.length === 0) {
          log.warn(Layout.schema.emptyExceptionMessage())
        }
      },
      assemble: (plugins) => {
        const nexusSchemaConfig = mapSettingsToNexusSchemaConfig(plugins, settings.data)

        nexusSchemaConfig.types.push(...statefulNexusSchema.state.types)
        nexusSchemaConfig.plugins!.push(...appState.schemaComponent.plugins)

        const { schema, missingTypes } = makeSchemaInternal(nexusSchemaConfig)

        appState.schemaComponent.schema = schema
        appState.schemaComponent.missingTypes = missingTypes
      },
    },
  }

  return api
}
