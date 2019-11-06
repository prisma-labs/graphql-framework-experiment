import * as nexus from 'nexus'
import * as path from 'path'
import { findProjectDir } from '../utils'

export function createNexusSingleton() {
  const __globalTypeDefs: any[] = []

  function makeSchema(): nexus.core.NexusGraphQLSchema {
    const shouldGenerateArtifacts =
      process.env.PUMPKINS_SHOULD_GENERATE_ARTIFACTS === 'true'
        ? true
        : process.env.PUMPKINS_SHOULD_GENERATE_ARTIFACTS === 'false'
        ? false
        : Boolean(
            !process.env.NODE_ENV || process.env.NODE_ENV === 'development'
          )
    const shouldExitAfterGenerateArtifacts =
      process.env.PUMPKINS_SHOULD_EXIT_AFTER_GENERATE_ARTIFACTS === 'true'
        ? true
        : false

    // TODO: Find better heuristic
    const projectDir = findProjectDir()
    const pumpkinsDir = path.join(projectDir, '.pumpkins')
    const defaultTypesPath = path.join(pumpkinsDir, 'nexus-typegen.ts')
    const defaultSchemaPath = path.join(projectDir, 'schema.graphql')

    const config: nexus.core.SchemaConfig = {
      types: __globalTypeDefs,
      outputs: {
        typegen: defaultTypesPath,
        schema: defaultSchemaPath,
      },
      shouldGenerateArtifacts,
      shouldExitAfterGenerateArtifacts,
    }
    return nexus.makeSchema(config)
  }

  function objectType<TypeName extends string>(
    config: nexus.core.NexusObjectTypeConfig<TypeName>
  ): nexus.core.NexusObjectTypeDef<TypeName> {
    const typeDef = nexus.objectType(config)
    __globalTypeDefs.push(typeDef)
    return typeDef
  }

  function inputObjectType<TypeName extends string>(
    config: nexus.core.NexusInputObjectTypeConfig<TypeName>
  ): nexus.core.NexusInputObjectTypeDef<TypeName> {
    const typeDef = nexus.inputObjectType(config)
    __globalTypeDefs.push(typeDef)
    return typeDef
  }

  function scalarType<TypeName extends string>(
    options: nexus.core.NexusScalarTypeConfig<TypeName>
  ): nexus.core.NexusScalarTypeDef<TypeName> {
    const typeDef = nexus.scalarType(options)
    __globalTypeDefs.push(typeDef)
    return typeDef
  }

  function enumType<TypeName extends string>(
    config: nexus.core.EnumTypeConfig<TypeName>
  ): nexus.core.NexusEnumTypeDef<TypeName> {
    const typeDef = nexus.enumType(config)
    __globalTypeDefs.push(typeDef)
    return typeDef
  }

  function unionType<TypeName extends string>(
    config: nexus.core.NexusUnionTypeConfig<TypeName>
  ): nexus.core.NexusUnionTypeDef<TypeName> {
    const typeDef = nexus.unionType(config)
    __globalTypeDefs.push(typeDef)
    return typeDef
  }

  return {
    objectType,
    inputObjectType,
    unionType,
    enumType,
    scalarType,
    makeSchema,
  }
}
