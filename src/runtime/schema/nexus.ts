import * as Nexus from '@nexus/schema'
import { AllTypeDefs } from '@nexus/schema/dist/core'
import * as CustomTypes from './custom-types'
import { makeSchemaWithoutTypegen, NexusSchemaWithMetadata } from './utils'

export type AllNexusTypeDefs =
  | AllTypeDefs
  | Nexus.core.NexusExtendInputTypeDef<any>
  | Nexus.core.NexusExtendTypeDef<any>

export function createNexusSingleton() {
  const __types: AllNexusTypeDefs[] = []

  function makeSchema(
    config: Nexus.core.SchemaConfig
  ): NexusSchemaWithMetadata {
    config.types.push(__types)

    return makeSchemaWithoutTypegen(config)
  }

  function objectType<TypeName extends string>(
    config: CustomTypes.NexusObjectTypeConfig<TypeName>
  ): Nexus.core.NexusObjectTypeDef<TypeName> {
    const typeDef = Nexus.objectType(config)
    __types.push(typeDef)
    return typeDef
  }

  function interfaceType<TypeName extends string>(
    config: CustomTypes.NexusInterfaceTypeConfig<TypeName>
  ): Nexus.core.NexusInterfaceTypeDef<TypeName> {
    const typeDef = Nexus.interfaceType(config)
    __types.push(typeDef)
    return typeDef
  }

  function unionType<TypeName extends string>(
    config: CustomTypes.NexusUnionTypeConfig<TypeName>
  ): Nexus.core.NexusUnionTypeDef<TypeName> {
    const typeDef = Nexus.unionType(config)
    __types.push(typeDef)
    return typeDef
  }

  function scalarType<TypeName extends string>(
    config: CustomTypes.NexusScalarTypeConfig<TypeName>
  ): Nexus.core.NexusScalarTypeDef<TypeName> {
    const typeDef = Nexus.scalarType(config)
    __types.push(typeDef)
    return typeDef
  }

  function enumType<TypeName extends string>(
    config: CustomTypes.NexusEnumTypeConfig<TypeName>
  ): Nexus.core.NexusEnumTypeDef<TypeName> {
    const typeDef = Nexus.enumType(config)
    __types.push(typeDef)
    return typeDef
  }

  const inputObjectType: typeof Nexus.inputObjectType = config => {
    const typeDef = Nexus.inputObjectType(config)
    __types.push(typeDef)
    return typeDef
  }

  const queryType: typeof Nexus.queryType = config => {
    const typeDef = Nexus.queryType(config)
    __types.push(typeDef)
    return typeDef
  }

  const mutationType: typeof Nexus.mutationType = config => {
    const typeDef = Nexus.mutationType(config)
    __types.push(typeDef)
    return typeDef
  }

  const extendType: typeof Nexus.extendType = config => {
    const typeDef = Nexus.extendType(config)
    __types.push(typeDef)
    return typeDef
  }

  const extendInputType: typeof Nexus.extendInputType = config => {
    const typeDef = Nexus.extendInputType(config)
    __types.push(typeDef)
    return typeDef
  }

  const arg = Nexus.arg
  const intArg = Nexus.intArg
  const stringArg = Nexus.stringArg
  const idArg = Nexus.idArg
  const floatArg = Nexus.floatArg
  const booleanArg = Nexus.booleanArg

  return {
    queryType,
    mutationType,
    objectType,
    inputObjectType,
    unionType,
    interfaceType,
    enumType,
    scalarType,
    arg,
    intArg,
    stringArg,
    idArg,
    floatArg,
    booleanArg,
    extendType,
    extendInputType,
    makeSchema,
    __types,
  }
}
