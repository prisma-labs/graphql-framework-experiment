import * as Nexus from '@nexus/schema'
import { AllTypeDefs, generateSchema } from '@nexus/schema/dist/core'
import { BackingTypes } from '../../lib/backing-types'
import { remapNexusTypesWithBackingTypes } from '../../lib/backing-types/remapNexusTypes'
import { GetNexusFutureGen } from '../../lib/backing-types/typeHelpers'

interface NexusObjectTypeConfig<TypeName extends string>
  extends Exclude<Nexus.core.NexusObjectTypeConfig<TypeName>, 'rootTyping'> {
  rootTyping?: GetNexusFutureGen<'types'> | Nexus.core.RootTypingImport
}

interface NexusInterfaceTypeConfig<TypeName extends string>
  extends Exclude<Nexus.core.NexusInterfaceTypeConfig<TypeName>, 'rootTyping'> {
  rootTyping?: GetNexusFutureGen<'types'> | Nexus.core.RootTypingImport
}

interface NexusUnionTypeConfig<TypeName extends string>
  extends Exclude<Nexus.core.NexusUnionTypeConfig<TypeName>, 'rootTyping'> {
  rootTyping?: GetNexusFutureGen<'types'> | Nexus.core.RootTypingImport
}

interface NexusEnumTypeConfig<TypeName extends string>
  extends Exclude<Nexus.core.EnumTypeConfig<TypeName>, 'rootTyping'> {
  rootTyping?: GetNexusFutureGen<'types'> | Nexus.core.RootTypingImport
}

interface NexusScalarTypeConfig<TypeName extends string>
  extends Exclude<Nexus.core.NexusScalarTypeConfig<TypeName>, 'rootTyping'> {
  rootTyping?: GetNexusFutureGen<'types'> | Nexus.core.RootTypingImport
}

export type AllNexusTypeDefs =
  | AllTypeDefs
  | Nexus.core.NexusExtendInputTypeDef<any>
  | Nexus.core.NexusExtendTypeDef<any>

export function createNexusSingleton() {
  const __types: AllNexusTypeDefs[] = []

  /**
   * Create the Nexus GraphQL Schema. If NEXUS_SHOULD_AWAIT_TYPEGEN=true then the typegen
   * disk write is awaited upon.
   */
  async function makeSchema(
    config: Nexus.core.SchemaConfig,
    backingTypes: BackingTypes
  ): Promise<Nexus.core.NexusGraphQLSchema> {
    const typesWithRemappedRootTypings = remapNexusTypesWithBackingTypes(
      __types,
      backingTypes
    )

    config.types.push(...typesWithRemappedRootTypings)

    // https://github.com/graphql-nexus/nexus-future/issues/33
    const schema = await (process.env.NEXUS_SHOULD_AWAIT_TYPEGEN === 'true'
      ? generateSchema(config)
      : Promise.resolve(Nexus.makeSchema(config)))

    // HACK `generateSchema` in Nexus does not support this logic yet
    // TODO move this logic into Nexus
    if (process.env.NEXUS_SHOULD_EXIT_AFTER_GENERATE_ARTIFACTS) {
      process.exit(0)
    }

    return schema
  }

  function objectType<TypeName extends string>(
    config: NexusObjectTypeConfig<TypeName>
  ): Nexus.core.NexusObjectTypeDef<TypeName> {
    const typeDef = Nexus.objectType(config)
    __types.push(typeDef)
    return typeDef
  }

  function interfaceType<TypeName extends string>(
    config: NexusInterfaceTypeConfig<TypeName>
  ): Nexus.core.NexusInterfaceTypeDef<TypeName> {
    const typeDef = Nexus.interfaceType(config)
    __types.push(typeDef)
    return typeDef
  }

  function unionType<TypeName extends string>(
    config: NexusUnionTypeConfig<TypeName>
  ): Nexus.core.NexusUnionTypeDef<TypeName> {
    const typeDef = Nexus.unionType(config)
    __types.push(typeDef)
    return typeDef
  }

  function scalarType<TypeName extends string>(
    config: NexusScalarTypeConfig<TypeName>
  ): Nexus.core.NexusScalarTypeDef<TypeName> {
    const typeDef = Nexus.scalarType(config)
    __types.push(typeDef)
    return typeDef
  }

  function enumType<TypeName extends string>(
    config: NexusEnumTypeConfig<TypeName>
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
