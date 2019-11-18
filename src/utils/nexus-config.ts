import * as fs from 'fs-jetpack'
import * as Nexus from 'nexus'
import * as path from 'path'
import { findProjectDir } from './path'

export type NexusConfig = Nexus.core.SchemaConfig

export function createNexusConfig({
  generatedPhotonPackagePath: photonPath,
  contextPath,
}: {
  generatedPhotonPackagePath: string
  contextPath: string
}): NexusConfig {
  const projectDir = findProjectDir()
  const defaultSchemaPath = path.join(projectDir, 'schema.graphql')
  const defaultTypesPath = fs.path(
    'node_modules/@types/typegen-nexus/index.d.ts'
  )

  return {
    outputs: {
      schema: defaultSchemaPath,
      typegen: defaultTypesPath,
    },
    typegenAutoConfig: {
      contextType: 'Context.Context',
      sources: [{ source: contextPath, alias: 'Context' }],
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
