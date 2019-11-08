import * as nexus from 'nexus'
import * as path from 'path'
import { findProjectDir } from '../utils'
import * as fs from 'fs-jetpack'

export type QueryType = typeof nexus.core.queryType
export type MutationType = typeof nexus.core.mutationType

export function createNexusSingleton() {
  const __types: any[] = []

  function makeSchema(
    overrides?: Partial<nexus.core.SchemaConfig>
  ): nexus.core.NexusGraphQLSchema {
    // TODO: Find better heuristic
    const projectDir = findProjectDir()
    const pumpkinsDir = path.join(projectDir, '.pumpkins')
    const defaultSchemaPath = path.join(projectDir, 'schema.graphql')
    // const defaultTypesPath = path.join(pumpkinsDir, 'nexus-typegen.ts')
    const defaultTypesPath = fs.path(
      'node_modules/@types/nexus-typegen/index.d.ts'
    )

    const config: nexus.core.SchemaConfig = {
      types: __types,
      outputs: {
        typegen: defaultTypesPath,
        schema: defaultSchemaPath,
      },
      // TODO semantic merge of overrides
      //      for example sources should be concatenated together
      //      but right now overrides would just wipe out any previous
      ...overrides,
    }

    return nexus.makeSchema(config)
  }

  function objectType<TypeName extends string>(
    config: nexus.core.NexusObjectTypeConfig<TypeName>
  ): nexus.core.NexusObjectTypeDef<TypeName> {
    const typeDef = nexus.objectType(config)
    __types.push(typeDef)
    return typeDef
  }

  function inputObjectType<TypeName extends string>(
    config: nexus.core.NexusInputObjectTypeConfig<TypeName>
  ): nexus.core.NexusInputObjectTypeDef<TypeName> {
    const typeDef = nexus.inputObjectType(config)
    __types.push(typeDef)
    return typeDef
  }

  function scalarType<TypeName extends string>(
    options: nexus.core.NexusScalarTypeConfig<TypeName>
  ): nexus.core.NexusScalarTypeDef<TypeName> {
    const typeDef = nexus.scalarType(options)
    __types.push(typeDef)
    return typeDef
  }

  function enumType<TypeName extends string>(
    config: nexus.core.EnumTypeConfig<TypeName>
  ): nexus.core.NexusEnumTypeDef<TypeName> {
    const typeDef = nexus.enumType(config)
    __types.push(typeDef)
    return typeDef
  }

  function unionType<TypeName extends string>(
    config: nexus.core.NexusUnionTypeConfig<TypeName>
  ): nexus.core.NexusUnionTypeDef<TypeName> {
    const typeDef = nexus.unionType(config)
    __types.push(typeDef)
    return typeDef
  }

  const queryType: QueryType = config => {
    const typeDef = nexus.queryType(config)
    __types.push(typeDef)
    return typeDef
  }

  const mutationType: MutationType = config => {
    const typeDef = nexus.mutationType(config)
    __types.push(typeDef)
    return typeDef
  }

  return {
    queryType,
    mutationType,
    objectType,
    inputObjectType,
    unionType,
    enumType,
    scalarType,
    makeSchema,
  }
}
