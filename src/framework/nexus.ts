import * as nexus from 'nexus'
import { generateSchema } from 'nexus/dist/core'
import * as fs from 'fs-jetpack'
import * as Nexus from 'nexus'

export function createNexusSingleton() {
  const __types: any[] = []

  /**
   * Create the Nexus GraphQL Schema. If GRAPHQL_SANTA_SHOULD_AWAIT_TYPEGEN=true then the typegen
   * disk write is awaited upon.
   */
  async function makeSchema(
    config: nexus.core.SchemaConfig
  ): Promise<nexus.core.NexusGraphQLSchema> {
    config.types.push(...__types)

    // https://github.com/prisma-labs/graphql-santa/issues/33
    const schema = await (process.env.GRAPHQL_SANTA_SHOULD_AWAIT_TYPEGEN ===
    'true'
      ? generateSchema(config)
      : Promise.resolve(nexus.makeSchema(config)))

    // HACK `generateSchema` in Nexus does not support this logic yet
    // TODO move this logic into Nexus
    if (process.env.GRAPHQL_SANTA_SHOULD_EXIT_AFTER_GENERATE_ARTIFACTS) {
      process.exit(0)
    }

    return schema
  }

  const objectType: typeof nexus.objectType = config => {
    const typeDef = nexus.objectType(config)
    __types.push(typeDef)
    return typeDef
  }

  const inputObjectType: typeof nexus.inputObjectType = config => {
    const typeDef = nexus.inputObjectType(config)
    __types.push(typeDef)
    return typeDef
  }

  const scalarType: typeof nexus.scalarType = config => {
    const typeDef = nexus.scalarType(config)
    __types.push(typeDef)
    return typeDef
  }

  const enumType: typeof nexus.enumType = config => {
    const typeDef = nexus.enumType(config)
    __types.push(typeDef)
    return typeDef
  }

  const unionType: typeof nexus.unionType = config => {
    const typeDef = nexus.unionType(config)
    __types.push(typeDef)
    return typeDef
  }

  const interfaceType: typeof nexus.interfaceType = config => {
    const typeDef = nexus.interfaceType(config)
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

  const extendType: typeof nexus.extendType = config => {
    const typeDef = nexus.extendType(config)
    __types.push(typeDef)
    return typeDef
  }

  const extendInputType: typeof nexus.extendInputType = config => {
    const typeDef = nexus.extendInputType(config)
    __types.push(typeDef)
    return typeDef
  }

  const intArg = nexus.intArg
  const stringArg = nexus.stringArg
  const idArg = nexus.idArg
  const floatArg = nexus.floatArg
  const booleanArg = nexus.booleanArg

  return {
    queryType,
    mutationType,
    objectType,
    inputObjectType,
    unionType,
    interfaceType,
    enumType,
    scalarType,
    intArg,
    stringArg,
    idArg,
    floatArg,
    booleanArg,
    extendType,
    extendInputType,
    makeSchema,
  }
}

export type NexusConfig = Nexus.core.SchemaConfig

export function createNexusConfig(): NexusConfig {
  const defaultTypesPath = fs.path(
    'node_modules/@types/typegen-nexus/index.d.ts'
  )

  return {
    outputs: {
      schema: false,
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
  process.env.GRAPHQL_SANTA_SHOULD_GENERATE_ARTIFACTS === 'true'
    ? true
    : process.env.GRAPHQL_SANTA_SHOULD_GENERATE_ARTIFACTS === 'false'
    ? false
    : Boolean(!process.env.NODE_ENV || process.env.NODE_ENV === 'development')

export const shouldExitAfterGenerateArtifacts = (): boolean =>
  process.env.GRAPHQL_SANTA_SHOULD_EXIT_AFTER_GENERATE_ARTIFACTS === 'true'
    ? true
    : false
