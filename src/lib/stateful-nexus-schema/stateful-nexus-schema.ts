import * as NexusSchema from '@nexus/schema'
import { AllTypeDefs } from '@nexus/schema/dist/core'
import * as CustomTypes from './custom-types'
import { makeSchemaWithoutTypegen, NexusSchemaWithMetadata } from './utils'

export interface SchemaTypeBuilders {
  queryType: typeof NexusSchema.queryType
  mutationType: typeof NexusSchema.mutationType
  objectType: ReturnType<typeof createStatefulNexusSchema>['objectType']
  enumType: ReturnType<typeof createStatefulNexusSchema>['enumType']
  scalarType: ReturnType<typeof createStatefulNexusSchema>['scalarType']
  unionType: ReturnType<typeof createStatefulNexusSchema>['unionType']
  interfaceType: ReturnType<typeof createStatefulNexusSchema>['interfaceType']
  inputObjectType: typeof NexusSchema.inputObjectType
  arg: typeof NexusSchema.arg
  intArg: typeof NexusSchema.intArg
  stringArg: typeof NexusSchema.stringArg
  booleanArg: typeof NexusSchema.booleanArg
  floatArg: typeof NexusSchema.floatArg
  idArg: typeof NexusSchema.idArg
  extendType: typeof NexusSchema.extendType
  extendInputType: typeof NexusSchema.extendInputType
}

export type AllNexusTypeDefs =
  | AllTypeDefs
  | NexusSchema.core.NexusExtendInputTypeDef<any>
  | NexusSchema.core.NexusExtendTypeDef<any>

export function createStatefulNexusSchema() {
  const __types: AllNexusTypeDefs[] = []

  function makeSchema(
    config: NexusSchema.core.SchemaConfig
  ): NexusSchemaWithMetadata {
    config.types.push(__types)

    return makeSchemaWithoutTypegen(config)
  }

  function writeTypegen() {}

  function objectType<TypeName extends string>(
    config: CustomTypes.NexusObjectTypeConfig<TypeName>
  ): NexusSchema.core.NexusObjectTypeDef<TypeName> {
    const typeDef = NexusSchema.objectType(config)
    __types.push(typeDef)
    return typeDef
  }

  function interfaceType<TypeName extends string>(
    config: CustomTypes.NexusInterfaceTypeConfig<TypeName>
  ): NexusSchema.core.NexusInterfaceTypeDef<TypeName> {
    const typeDef = NexusSchema.interfaceType(config)
    __types.push(typeDef)
    return typeDef
  }

  function unionType<TypeName extends string>(
    config: CustomTypes.NexusUnionTypeConfig<TypeName>
  ): NexusSchema.core.NexusUnionTypeDef<TypeName> {
    const typeDef = NexusSchema.unionType(config)
    __types.push(typeDef)
    return typeDef
  }

  function scalarType<TypeName extends string>(
    config: CustomTypes.NexusScalarTypeConfig<TypeName>
  ): NexusSchema.core.NexusScalarTypeDef<TypeName> {
    const typeDef = NexusSchema.scalarType(config)
    __types.push(typeDef)
    return typeDef
  }

  function enumType<TypeName extends string>(
    config: CustomTypes.NexusEnumTypeConfig<TypeName>
  ): NexusSchema.core.NexusEnumTypeDef<TypeName> {
    const typeDef = NexusSchema.enumType(config)
    __types.push(typeDef)
    return typeDef
  }

  const inputObjectType: typeof NexusSchema.inputObjectType = (config) => {
    const typeDef = NexusSchema.inputObjectType(config)
    __types.push(typeDef)
    return typeDef
  }

  const queryType: typeof NexusSchema.queryType = (config) => {
    const typeDef = NexusSchema.queryType(config)
    __types.push(typeDef)
    return typeDef
  }

  const mutationType: typeof NexusSchema.mutationType = (config) => {
    const typeDef = NexusSchema.mutationType(config)
    __types.push(typeDef)
    return typeDef
  }

  const extendType: typeof NexusSchema.extendType = (config) => {
    const typeDef = NexusSchema.extendType(config)
    __types.push(typeDef)
    return typeDef
  }

  const extendInputType: typeof NexusSchema.extendInputType = (config) => {
    const typeDef = NexusSchema.extendInputType(config)
    __types.push(typeDef)
    return typeDef
  }

  const arg = NexusSchema.arg
  const intArg = NexusSchema.intArg
  const stringArg = NexusSchema.stringArg
  const idArg = NexusSchema.idArg
  const floatArg = NexusSchema.floatArg
  const booleanArg = NexusSchema.booleanArg

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
