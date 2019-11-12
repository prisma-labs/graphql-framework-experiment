import * as nexus from 'nexus'
import * as path from 'path'
import { findProjectDir } from '../utils'
import * as fs from 'fs-jetpack'

export type QueryType = typeof nexus.core.queryType
export type MutationType = typeof nexus.core.mutationType

export function createNexusSingleton() {
  const __types: any[] = []

  function makeSchema(
    config: Omit<nexus.core.SchemaConfig, 'types'>
  ): nexus.core.NexusGraphQLSchema {
    const configWithTypes: nexus.core.SchemaConfig = {
      types: __types,
      ...config,
    }

    return nexus.makeSchema(configWithTypes)
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
