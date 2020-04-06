import * as NexusSchema from '@nexus/schema'
import * as BackingTypes from '../backing-types'
import { Layout } from '../layout'

export async function writeTypegen(
  schema: NexusSchema.core.NexusGraphQLSchema,
  finalConfig: NexusSchema.core.BuilderConfig,
  rootTypingsGlobPattern: string | undefined,
  layout: Layout
): Promise<void> {
  const typegenConfig = NexusSchema.core.resolveTypegenConfig(finalConfig)
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
