import * as NexusSchema from '@nexus/schema'
import * as HTTP from 'http'
import * as Layout from '../../lib/layout'
import * as Logger from '../../lib/logger'
import { RuntimeContributions } from '../../lib/plugin'
import {
  createStatefulNexusSchema,
  StatefulNexusSchemaBuilders,
  writeTypegen,
} from '../../lib/stateful-nexus-schema'
import { log } from './logger'
import {
  changeSettings,
  mapSettingsToNexusSchemaConfig,
  SettingsData,
  SettingsInput,
} from './settings'

interface Request extends HTTP.IncomingMessage {
  log: Logger.Logger
}

export type ContextContributor<Req> = (req: Req) => Record<string, unknown>

export interface Schema extends StatefulNexusSchemaBuilders {
  addToContext: <Req = Request>(
    contextContributor: ContextContributor<Req>
  ) => void
}

interface SchemaInternal {
  private: {
    state: {
      settings: SettingsData
      contextContributors: ContextContributor<any>[]
    }
    /**
     * Create the Nexus GraphQL Schema. If NEXUS_SHOULD_AWAIT_TYPEGEN=true then the typegen
     * disk write is awaited upon.
     */
    makeSchema: (
      plugins: RuntimeContributions[]
    ) => Promise<NexusSchema.core.NexusGraphQLSchema>
    settings: {
      data: SettingsData
      change: (newSettings: SettingsInput) => void
    }
  }
  public: Schema
}

export function create(): SchemaInternal {
  const statefulNexusSchema = createStatefulNexusSchema()

  const state: SchemaInternal['private']['state'] = {
    settings: {},
    contextContributors: [],
  }

  const api: SchemaInternal = {
    public: {
      ...statefulNexusSchema.builders,
      addToContext(contextContributor) {
        state.contextContributors.push(contextContributor)
      },
    },
    private: {
      state: state,
      makeSchema: async (plugins) => {
        const nexusSchemaConfig = mapSettingsToNexusSchemaConfig(
          plugins,
          state.settings
        )
        const {
          schema,
          missingTypes,
          typegenConfig,
        } = statefulNexusSchema.makeSchema(nexusSchemaConfig)
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
