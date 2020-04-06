import * as NexusSchema from '@nexus/schema'
import * as BackingTypes from '../backing-types'
import { Layout } from '../layout'

export type NexusSchemaWithMetadata = {
  schema: ReturnType<typeof NexusSchema.core.makeSchemaInternal>['schema']
  missingTypes: ReturnType<
    typeof NexusSchema.core.makeSchemaInternal
  >['missingTypes']
  typegenConfig: NexusSchema.core.TypegenMetadataConfig
}

export function makeSchemaWithoutTypegen(
  config: NexusSchema.core.SchemaConfig
): NexusSchemaWithMetadata {
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
  layout: Layout
): Promise<void> {
  const backingTypes = await BackingTypes.extractAndWrite(
    rootTypingsGlobPattern,
    {
      extractCwd: layout.sourceRoot,
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
