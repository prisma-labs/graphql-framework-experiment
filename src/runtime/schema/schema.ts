import * as NexusSchema from '@nexus/schema'
import { makeSchemaInternal } from '@nexus/schema/dist/core'
import * as HTTP from 'http'
import { runAddToContextExtractorAsWorkerIfPossible } from '../../lib/add-to-context-extractor/add-to-context-extractor'
import * as Layout from '../../lib/layout'
import * as Logger from '../../lib/logger'
import {
  createNexusSchemaStateful,
  NexusSchemaStatefulBuilders,
  writeTypegen,
} from '../../lib/nexus-schema-stateful'
import { RuntimeContributions } from '../../lib/plugin'
import { log } from './logger'
import { changeSettings, mapSettingsToNexusSchemaConfig, SettingsData, SettingsInput } from './settings'

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

export type ContextContributor<Req> = (req: Req) => Record<string, unknown>

export interface Schema extends NexusSchemaStatefulBuilders {
  /**
   * todo link to website docs
   */
  use: (schemaPlugin: NexusSchema.core.NexusPlugin) => void
  /**
   * todo link to website docs
   */
  addToContext: <Req = Request>(contextContributor: ContextContributor<Req>) => void
}

interface SchemaInternal {
  private: {
    state: {
      settings: SettingsData
      schemaPlugins: NexusSchema.core.NexusPlugin[]
      contextContributors: ContextContributor<any>[]
    }
    /**
     * Create the Nexus GraphQL Schema. If NEXUS_SHOULD_AWAIT_TYPEGEN=true then the typegen
     * disk write is awaited upon.
     */
    makeSchema: (plugins: RuntimeContributions[]) => Promise<NexusSchema.core.NexusGraphQLSchema>
    settings: {
      data: SettingsData
      change: (newSettings: SettingsInput) => void
    }
  }
  public: Schema
}

export function create(): SchemaInternal {
  const statefulNexusSchema = createNexusSchemaStateful()

  const state: SchemaInternal['private']['state'] = {
    schemaPlugins: [],
    settings: {},
    contextContributors: [],
  }

  const api: SchemaInternal = {
    public: {
      ...statefulNexusSchema.builders,
      use(plugin) {
        // todo if caleld after app start, raise a warning (dev), error (prod)
        // this will require the component having access to some of the
        // framework state.
        state.schemaPlugins.push(plugin)
      },
      addToContext(contextContributor) {
        state.contextContributors.push(contextContributor)
      },
    },
    private: {
      state: state,
      makeSchema: async (plugins) => {
        const nexusSchemaConfig = mapSettingsToNexusSchemaConfig(plugins, state.settings)

        nexusSchemaConfig.types.push(...statefulNexusSchema.state.types)

        nexusSchemaConfig.plugins!.push(...state.schemaPlugins)

        const { schema, missingTypes, finalConfig } = makeSchemaInternal(nexusSchemaConfig)

        if (nexusSchemaConfig.shouldGenerateArtifacts === true) {
          const devModeLayout = await Layout.loadDataFromParentProcess()

          if (!devModeLayout) {
            throw new Error(
              'Layout should be defined when should gen artifacts is true. This should not happen.'
            )
          }

          const contextExtractionPromise = runAddToContextExtractorAsWorkerIfPossible(devModeLayout.data)

          const typegenPromise = writeTypegen(
            schema,
            finalConfig,
            state.settings.rootTypingsGlobPattern,
            devModeLayout
          )

          // Await promise only if needed. Otherwise let it run in the background
          if (process.env.NEXUS_SHOULD_AWAIT_TYPEGEN === 'true') {
            await Promise.all([typegenPromise, contextExtractionPromise])
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

        if (statefulNexusSchema.state.types.length === 0) {
          log.warn(Layout.schema.emptyExceptionMessage())
        }

        return schema
      },
      settings: {
        data: state.settings,
        change(newSettings) {
          changeSettings(state.settings, newSettings)
        },
      },
    },
  }

  return api
}
