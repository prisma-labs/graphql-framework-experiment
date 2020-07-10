import * as NexusSchema from '@nexus/schema'
import chalk from 'chalk'
import * as GraphQL from 'graphql'
import { logPrettyError } from '../errors'
import { rootLogger } from '../nexus-logger'
import * as Scalars from '../scalars'
import * as CustomTypes from './custom-types'

type RequiredKeys<T> = { [K in keyof T]-?: {} extends Pick<T, K> ? never : K }[keyof T]

const log = rootLogger.child('schema')
const prettyFatal = (err: Error) => logPrettyError(log, err, 'fatal')

function validateInput<T extends Record<string, any>>(
  config: T | undefined,
  requiredProperties: RequiredKeys<T>[]
): never | true {
  if (!config) {
    logPrettyError(log, new Error('Missing config'), 'fatal')
  }

  for (const prop of requiredProperties) {
    if (config[prop] === undefined) {
      if (config.name) {
        prettyFatal(
          new Error(
            `Missing property \`${chalk.redBright(prop)}\` for GraphQL type "${chalk.greenBright(
              config.name
            )}"`
          )
        )
      } else {
        prettyFatal(new Error(`Missing property \`${chalk.redBright(prop)}\``))
      }
    }
  }

  return true
}

// todo use this as return type of constructor
export interface StatefulNexusSchema {
  state: {
    types: NexusSchemaTypeDef[]
    scalars: Scalars.Scalars
  }
  builders: NexusSchemaStatefulBuilders
}

// prettier-ignore
export interface NexusSchemaStatefulBuilders {
  queryType: typeof NexusSchema.queryType
  mutationType: typeof NexusSchema.mutationType
  subscriptionType: typeof NexusSchema.subscriptionType
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
  | NexusSchema.core.AllTypeDefs
  | NexusSchema.core.NexusExtendInputTypeDef<any>
  | NexusSchema.core.NexusExtendTypeDef<any>

/**
 * Create an instance of Stateful Nexus Schema
 */
export function createNexusSchemaStateful() {
  const state: StatefulNexusSchema['state'] = {
    types: [],
    scalars: {},
  }

  function objectType<TypeName extends string>(
    config: CustomTypes.NexusObjectTypeConfig<TypeName>
  ): NexusSchema.core.NexusObjectTypeDef<TypeName> {
    validateInput(config, ['name', 'definition'])

    try {
      const typeDef = NexusSchema.objectType(config)
      state.types.push(typeDef)
      return typeDef
    } catch (err) {
      return prettyFatal(err)
    }
  }

  function interfaceType<TypeName extends string>(
    config: CustomTypes.NexusInterfaceTypeConfig<TypeName>
  ): NexusSchema.core.NexusInterfaceTypeDef<TypeName> {
    validateInput(config, ['name', 'definition'])

    try {
      const typeDef = NexusSchema.interfaceType(config)
      state.types.push(typeDef)
      return typeDef
    } catch (err) {
      return prettyFatal(err)
    }
  }

  function unionType<TypeName extends string>(
    config: CustomTypes.NexusUnionTypeConfig<TypeName>
  ): NexusSchema.core.NexusUnionTypeDef<TypeName> {
    validateInput(config, ['name', 'definition'])

    try {
      const typeDef = NexusSchema.unionType(config)
      state.types.push(typeDef)
      return typeDef
    } catch (err) {
      return prettyFatal(err)
    }
  }

  function scalarType<TypeName extends string>(
    config: CustomTypes.NexusScalarTypeConfig<TypeName>
  ): NexusSchema.core.NexusScalarTypeDef<TypeName> {
    validateInput(config, ['name', 'serialize'])

    try {
      const typeDef = NexusSchema.scalarType(config)
      state.types.push(typeDef)
      state.scalars[typeDef.name] = new GraphQL.GraphQLScalarType(config)
      return typeDef
    } catch (err) {
      return prettyFatal(err)
    }
  }

  function enumType<TypeName extends string>(
    config: CustomTypes.NexusEnumTypeConfig<TypeName>
  ): NexusSchema.core.NexusEnumTypeDef<TypeName> {
    validateInput(config, ['name', 'members'])

    try {
      const typeDef = NexusSchema.enumType(config)
      state.types.push(typeDef)
      return typeDef
    } catch (err) {
      return prettyFatal(err)
    }
  }

  const inputObjectType: typeof NexusSchema.inputObjectType = (config) => {
    validateInput(config, ['name', 'definition'])

    try {
      const typeDef = NexusSchema.inputObjectType(config)
      state.types.push(typeDef)
      return typeDef
    } catch (err) {
      return prettyFatal(err)
    }
  }

  const queryType: typeof NexusSchema.queryType = (config) => {
    validateInput(config, ['definition'])

    try {
      const typeDef = NexusSchema.queryType(config)
      state.types.push(typeDef)
      return typeDef
    } catch (err) {
      return prettyFatal(err)
    }
  }

  const mutationType: typeof NexusSchema.mutationType = (config) => {
    validateInput(config, ['definition'])

    try {
      const typeDef = NexusSchema.mutationType(config)
      state.types.push(typeDef)
      return typeDef
    } catch (err) {
      return prettyFatal(err)
    }
  }

  const subscriptionType: typeof NexusSchema.subscriptionType = (config) => {
    validateInput(config, ['definition'])

    try {
      const typeDef = NexusSchema.subscriptionType(config)
      state.types.push(typeDef)
      return typeDef
    } catch (err) {
      return prettyFatal(err)
    }
  }

  const extendType: typeof NexusSchema.extendType = (config) => {
    validateInput(config, ['definition'])

    try {
      const typeDef = NexusSchema.extendType(config)
      state.types.push(typeDef)
      return typeDef
    } catch (err) {
      return prettyFatal(err)
    }
  }

  const extendInputType: typeof NexusSchema.extendInputType = (config) => {
    validateInput(config, ['definition'])

    try {
      const typeDef = NexusSchema.extendInputType(config)
      state.types.push(typeDef)
      return typeDef
    } catch (err) {
      return prettyFatal(err)
    }
  }

  function importType(type: GraphQL.GraphQLScalarType, methodName?: string): GraphQL.GraphQLScalarType
  function importType(type: GraphQL.GraphQLNamedType): GraphQL.GraphQLNamedType
  function importType(type: GraphQL.GraphQLNamedType, methodName?: string): GraphQL.GraphQLNamedType {
    validateInput({ type }, ['type'])

    try {
      if (type instanceof GraphQL.GraphQLScalarType && methodName) {
        const typeDef = NexusSchema.asNexusMethod(type, methodName)
        state.types.push(typeDef)
        state.scalars[typeDef.name] = typeDef
        return typeDef
      }

      state.types.push(type)
      return type
    } catch (err) {
      return prettyFatal(err)
    }
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
      subscriptionType,
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
