import * as NexusSchema from '@nexus/schema'
import { AllTypeDefs } from '@nexus/schema/dist/core'
import * as CustomTypes from './custom-types'
import { makeSchemaWithoutTypegen, NexusSchemaWithMetadata } from './utils'

// todo use this as return type of constructor
export interface StatefulNexusSchema {
  state: {
    types: NexusSchemaTypeDef[]
  }
  builders: StatefulNexusSchemaBuilders
}

// prettier-ignore
export interface StatefulNexusSchemaBuilders {
  queryType: typeof NexusSchema.queryType
  mutationType: typeof NexusSchema.mutationType
  objectType: ReturnType<typeof createStatefulNexusSchema>['builders']['objectType']
  enumType: ReturnType<typeof createStatefulNexusSchema>['builders']['enumType']
  scalarType: ReturnType<typeof createStatefulNexusSchema>['builders']['scalarType']
  unionType: ReturnType<typeof createStatefulNexusSchema>['builders']['unionType']
  interfaceType: ReturnType<typeof createStatefulNexusSchema>['builders']['interfaceType']
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

type NexusSchemaTypeDef =
  | AllTypeDefs
  | NexusSchema.core.NexusExtendInputTypeDef<any>
  | NexusSchema.core.NexusExtendTypeDef<any>

export function createStatefulNexusSchema() {
  const state: StatefulNexusSchema['state'] = {
    types: [],
  }

  function makeSchema(
    config: NexusSchema.core.SchemaConfig
  ): NexusSchemaWithMetadata {
    config.types.push(state.types)

    return makeSchemaWithoutTypegen(config)
  }

  function objectType<TypeName extends string>(
    config: CustomTypes.NexusObjectTypeConfig<TypeName>
  ): NexusSchema.core.NexusObjectTypeDef<TypeName> {
    const typeDef = NexusSchema.objectType(config)
    state.types.push(typeDef)
    return typeDef
  }

  function interfaceType<TypeName extends string>(
    config: CustomTypes.NexusInterfaceTypeConfig<TypeName>
  ): NexusSchema.core.NexusInterfaceTypeDef<TypeName> {
    const typeDef = NexusSchema.interfaceType(config)
    state.types.push(typeDef)
    return typeDef
  }

  function unionType<TypeName extends string>(
    config: CustomTypes.NexusUnionTypeConfig<TypeName>
  ): NexusSchema.core.NexusUnionTypeDef<TypeName> {
    const typeDef = NexusSchema.unionType(config)
    state.types.push(typeDef)
    return typeDef
  }

  function scalarType<TypeName extends string>(
    config: CustomTypes.NexusScalarTypeConfig<TypeName>
  ): NexusSchema.core.NexusScalarTypeDef<TypeName> {
    const typeDef = NexusSchema.scalarType(config)
    state.types.push(typeDef)
    return typeDef
  }

  function enumType<TypeName extends string>(
    config: CustomTypes.NexusEnumTypeConfig<TypeName>
  ): NexusSchema.core.NexusEnumTypeDef<TypeName> {
    const typeDef = NexusSchema.enumType(config)
    state.types.push(typeDef)
    return typeDef
  }

  const inputObjectType: typeof NexusSchema.inputObjectType = (config) => {
    const typeDef = NexusSchema.inputObjectType(config)
    state.types.push(typeDef)
    return typeDef
  }

  const queryType: typeof NexusSchema.queryType = (config) => {
    const typeDef = NexusSchema.queryType(config)
    state.types.push(typeDef)
    return typeDef
  }

  const mutationType: typeof NexusSchema.mutationType = (config) => {
    const typeDef = NexusSchema.mutationType(config)
    state.types.push(typeDef)
    return typeDef
  }

  const extendType: typeof NexusSchema.extendType = (config) => {
    const typeDef = NexusSchema.extendType(config)
    state.types.push(typeDef)
    return typeDef
  }

  const extendInputType: typeof NexusSchema.extendInputType = (config) => {
    const typeDef = NexusSchema.extendInputType(config)
    state.types.push(typeDef)
    return typeDef
  }

  const arg = NexusSchema.arg
  const intArg = NexusSchema.intArg
  const stringArg = NexusSchema.stringArg
  const idArg = NexusSchema.idArg
  const floatArg = NexusSchema.floatArg
  const booleanArg = NexusSchema.booleanArg

  return {
    makeSchema: makeSchema,
    state: state,
    builders: {
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
    },
  }
}
