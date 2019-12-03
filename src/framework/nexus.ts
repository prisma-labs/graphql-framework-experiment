import * as nexus from 'nexus'
import { generateSchema } from 'nexus/dist/core'
import * as fs from 'fs-jetpack'
import * as Nexus from 'nexus'

export function createNexusSingleton() {
  const __types: any[] = []

  /**
   * Create the Nexus GraohQL Schema. If PUMPKINS_SHOULD_AWAIT_TYPEGEN=true then the typegen
   * disk write is awaited upon.
   */
  async function makeSchema(
    config: nexus.core.SchemaConfig
  ): Promise<nexus.core.NexusGraphQLSchema> {
    config.types.push(...__types)

    // https://github.com/prisma/pumpkins/issues/33
    const schema = await (process.env.PUMPKINS_SHOULD_AWAIT_TYPEGEN === 'true'
      ? generateSchema(config)
      : Promise.resolve(nexus.makeSchema(config)))

    // HACK `generateSchema` in Nexus does not support this logic yet
    // TODO move this logic into Nexus
    if (process.env.PUMPKINS_SHOULD_EXIT_AFTER_GENERATE_ARTIFACTS) {
      process.exit(0)
    }

    return schema
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

  const queryType: typeof nexus.queryType = config => {
    const typeDef = nexus.queryType(config)
    __types.push(typeDef)
    return typeDef
  }

  const mutationType: typeof nexus.mutationType = config => {
    const typeDef = nexus.mutationType(config)
    __types.push(typeDef)
    return typeDef
  }

  const intArg = nexus.intArg
  const stringArg = nexus.stringArg

  return {
    queryType,
    mutationType,
    objectType,
    inputObjectType,
    unionType,
    enumType,
    scalarType,
    intArg,
    stringArg,
    makeSchema,
  }
}

export type NexusConfig = Nexus.core.SchemaConfig

export function createNexusConfig(): NexusConfig {
  const defaultTypesPath = fs.path(
    'node_modules/@types/typegen-nexus/index.d.ts'
  )
  const defaultSchemaPath = fs.path('schema.graphql')

  return {
    outputs: {
      schema: defaultSchemaPath,
      typegen: defaultTypesPath,
    },
    typegenAutoConfig: {
      sources: [],
    },
    shouldGenerateArtifacts: shouldGenerateArtifacts(),
    shouldExitAfterGenerateArtifacts: shouldExitAfterGenerateArtifacts(),
    types: [],
  }
}

export const shouldGenerateArtifacts = (): boolean =>
  process.env.PUMPKINS_SHOULD_GENERATE_ARTIFACTS === 'true'
    ? true
    : process.env.PUMPKINS_SHOULD_GENERATE_ARTIFACTS === 'false'
    ? false
    : Boolean(!process.env.NODE_ENV || process.env.NODE_ENV === 'development')

export const shouldExitAfterGenerateArtifacts = (): boolean =>
  process.env.PUMPKINS_SHOULD_EXIT_AFTER_GENERATE_ARTIFACTS === 'true'
    ? true
    : false
