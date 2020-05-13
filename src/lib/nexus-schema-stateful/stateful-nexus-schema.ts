import * as NexusSchema from '@nexus/schema'
import type { AllTypeDefs } from '@nexus/schema/dist/core'
import * as GraphQL from 'graphql'
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
  /**
   * Add a GraphQL.js type in your Nexus schema
   */
  importType: {
    /**
     * Add a GraphQL.js scalar type and (optionally) expose it as a method in your definition builders.
     * Check the second overload if you're not adding a scalar type.
     * 
     * @example
     * 
     * ```ts
     * import { schema } from 'nexus'
     * import { GraphQLDate } from 'graphql-iso-date'
     *
     * schema.importType(GraphQLDate, 'date')
     *
     * schema.objectType({
     *  name: 'SomeObject',
     *  definition(t) {
     *    t.date('createdAt') // t.date() is now available (with types!) thanks to `importType`
     *  },
     * })
     * ```
     *
     */
    (scalarType: GraphQL.GraphQLScalarType, methodName?: string): GraphQL.GraphQLScalarType
    /**
     * Add a GraphQL.js type in your Nexus schema.
     * Useful to incrementally adopt Nexus if you already have a GraphQL schema built with a different technology than Nexus.
     * 
     * @example
     * 
     * ```ts
     * import { schema } from 'nexus'
     * import { existingSchema } from './existing-schema'
     * 
     * Object.values(
     *   existingSchema.getTypeMap()
     * ).forEach(schema.importType)
     * ```
     */
    (type: GraphQL.GraphQLNamedType): GraphQL.GraphQLNamedType
  }
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

  function importType(type: GraphQL.GraphQLScalarType, methodName?: string): GraphQL.GraphQLScalarType
  function importType(type: GraphQL.GraphQLNamedType): GraphQL.GraphQLNamedType
  function importType(type: GraphQL.GraphQLNamedType, methodName?: string): GraphQL.GraphQLNamedType {
    if (type instanceof GraphQL.GraphQLScalarType && methodName) {
      const typeDef = NexusSchema.asNexusMethod(type, methodName)
      state.types.push(typeDef)
      return typeDef
    }

    state.types.push(type)
    return type
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
      importType,
    },
  }
}
