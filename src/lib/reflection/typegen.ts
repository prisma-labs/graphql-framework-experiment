import * as NexusSchema from '@nexus/schema'
import * as Schema from '../../runtime/schema'
import { generateContextExtractionArtifacts } from '../add-to-context-extractor'
import * as Layout from '../layout'
import * as BackingTypes from '../nexus-schema-backing-types'
import { generateArtifacts } from '../nexus-schema-stateful/typegen'
import * as Plugin from '../plugin'

interface TypegenParams {
  layout: Layout.Layout
  graphqlSchema: NexusSchema.core.NexusGraphQLSchema
  schemaSettings: Schema.SettingsData
  plugins: Plugin.RuntimeContributions[]
}

export async function writeArtifacts(params: TypegenParams) {
  // Generate the backing types typegen file
  const backingTypes = await BackingTypes.generateBackingTypesArtifacts(
    params.schemaSettings.rootTypingsGlobPattern,
    {
      extractCwd: params.layout.sourceRoot,
    }
  )

  // Generate the nexus typegen file and the GraphQL SDL file
  const nexusSchemaTypegenPromise = generateArtifacts({
    ...params,
    graphqlSchema: BackingTypes.remapSchemaWithRootTypings(params.graphqlSchema, backingTypes),
  })
  // Generate the context typegen file
  const contextExtractorTypegenPromise = generateContextExtractionArtifacts(params.layout)

  await Promise.all([nexusSchemaTypegenPromise, contextExtractorTypegenPromise])
}
