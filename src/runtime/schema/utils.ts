import * as NexusSchema from '@nexus/schema'
import * as BackingTypes from '../../lib/backing-types'
import { Layout } from '../../lib/layout'

export type EnhancedSchema = {
  schema: ReturnType<typeof NexusSchema.core.makeSchemaInternal>['schema']
  missingTypes: ReturnType<
    typeof NexusSchema.core.makeSchemaInternal
  >['missingTypes']
  typegenConfig: NexusSchema.core.TypegenMetadataConfig
}

export async function makeSchemaWithoutTypegen(
  config: NexusSchema.core.SchemaConfig
): Promise<EnhancedSchema> {
  const {
    schema,
    missingTypes,
    finalConfig,
  } = NexusSchema.core.makeSchemaInternal(config)
  const typegenConfig = NexusSchema.core.resolveTypegenConfig(finalConfig)

  return { schema, typegenConfig, missingTypes }
}

export async function writeTypegen(
  schema: NexusSchema.core.NexusGraphQLSchema,
  typegenConfig: NexusSchema.core.TypegenMetadataConfig,
  rootTypingsGlobPattern: string | undefined,
  devModeLayout: Layout
): Promise<void> {
  const backingTypes = await BackingTypes.extractAndWrite(
    rootTypingsGlobPattern,
    {
      extractCwd: devModeLayout.sourceRoot,
    }
  )
  const schemaWithRemappedBackingTypes = BackingTypes.withRemappedRootTypings(
    schema,
    backingTypes
  )

  await new NexusSchema.core.TypegenMetadata(typegenConfig).generateArtifacts(
    schemaWithRemappedBackingTypes
  )
}
