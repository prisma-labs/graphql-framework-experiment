import * as Nexus from '@nexus/schema'
import { generateSchema } from '@nexus/schema/dist/core'
import * as fs from 'fs-jetpack'

export function createNexusSingleton() {
  const __types: any[] = []

  /**
   * Create the Nexus GraphQL Schema. If NEXUS_SHOULD_AWAIT_TYPEGEN=true then the typegen
   * disk write is awaited upon.
   */
  async function makeSchema(
    config: Nexus.core.SchemaConfig
  ): Promise<Nexus.core.NexusGraphQLSchema> {
    config.types.push(...__types)

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

  /**
   * Internal function, do not expose to the surface API
   */
  const _getNexusTypesFromSingleton = () => {
    return __types
  }

  const objectType: typeof Nexus.objectType = config => {
    const typeDef = Nexus.objectType(config)
    __types.push(typeDef)
    return typeDef
  }

  const inputObjectType: typeof Nexus.inputObjectType = config => {
    const typeDef = Nexus.inputObjectType(config)
    __types.push(typeDef)
    return typeDef
  }

  const scalarType: typeof Nexus.scalarType = config => {
    const typeDef = Nexus.scalarType(config)
    __types.push(typeDef)
    return typeDef
  }

  const enumType: typeof Nexus.enumType = config => {
    const typeDef = Nexus.enumType(config)
    __types.push(typeDef)
    return typeDef
  }

  const unionType: typeof Nexus.unionType = config => {
    const typeDef = Nexus.unionType(config)
    __types.push(typeDef)
    return typeDef
  }

  const interfaceType: typeof Nexus.interfaceType = config => {
    const typeDef = Nexus.interfaceType(config)
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
    intArg,
    stringArg,
    idArg,
    floatArg,
    booleanArg,
    extendType,
    extendInputType,
    makeSchema,
    _getNexusTypesFromSingleton,
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
  process.env.NEXUS_SHOULD_GENERATE_ARTIFACTS === 'true'
    ? true
    : process.env.NEXUS_SHOULD_GENERATE_ARTIFACTS === 'false'
    ? false
    : Boolean(!process.env.NODE_ENV || process.env.NODE_ENV === 'development')

export const shouldExitAfterGenerateArtifacts = (): boolean =>
  process.env.NEXUS_SHOULD_EXIT_AFTER_GENERATE_ARTIFACTS === 'true'
    ? true
    : false
