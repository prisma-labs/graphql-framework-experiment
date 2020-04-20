import * as NexusSchema from '@nexus/schema'
import { AllTypeDefs } from '@nexus/schema/dist/core'
import * as CustomTypes from './custom-types'

// todo use this as return type of constructor
export interface StatefulNexusSchema {
  state: {
    types: NexusSchemaTypeDef[]
  }
  builders: NexusSchemaStatefulBuilders
}

// prettier-ignore
export interface NexusSchemaStatefulBuilders {
  queryType: typeof NexusSchema.queryType
  mutationType: typeof NexusSchema.mutationType
  objectType: ReturnType<typeof createNexusSchemaStateful>['builders']['objectType']
  enumType: ReturnType<typeof createNexusSchemaStateful>['builders']['enumType']
  scalarType: ReturnType<typeof createNexusSchemaStateful>['builders']['scalarType']
  unionType: ReturnType<typeof createNexusSchemaStateful>['builders']['unionType']
  interfaceType: ReturnType<typeof createNexusSchemaStateful>['builders']['interfaceType']
  inputObjectType: typeof NexusSchema.inputObjectType
  arg: typeof NexusSchema.arg
  intArg: typeof NexusSchema.intArg
  stringArg: typeof NexusSchema.stringArg
  booleanArg: typeof NexusSchema.booleanArg
  floatArg: typeof NexusSchema.floatArg
  idArg: typeof NexusSchema.idArg
  extendType: typeof NexusSchema.extendType
  extendInputType: typeof NexusSchema.extendInputType
  queryField: typeof NexusSchema.queryField
  mutationField: typeof NexusSchema.mutationField
  subscriptionField: typeof NexusSchema.subscriptionField
  asNexusMethod: typeof NexusSchema.asNexusMethod
}

type NexusSchemaTypeDef =
  | AllTypeDefs
  | NexusSchema.core.NexusExtendInputTypeDef<any>
  | NexusSchema.core.NexusExtendTypeDef<any>

export function createNexusSchemaStateful() {
  const state: StatefulNexusSchema['state'] = {
    types: [],
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

  const asNexusMethod: typeof NexusSchema.asNexusMethod = (scalar, methodName) => {
    const typeDef = NexusSchema.asNexusMethod(scalar, methodName)
    state.types.push(typeDef)
    return typeDef
  }

  const subscriptionField: typeof NexusSchema.subscriptionField = (fieldName, config) => {
    const typeDef = NexusSchema.subscriptionField(fieldName, config)
    state.types.push(typeDef)
    return typeDef
  }

  const queryField: typeof NexusSchema.queryField = (...args: any[]) => {
    const typeDef = NexusSchema.queryField(args[0], args[1]) as any
    state.types.push(typeDef)
    return typeDef
  }

  const mutationField: typeof NexusSchema.mutationField = (...args: any[]) => {
    const typeDef = NexusSchema.mutationField(args[0], args[1]) as any
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
      queryField,
      mutationField,
      subscriptionField,
      asNexusMethod,
    },
  }
}
