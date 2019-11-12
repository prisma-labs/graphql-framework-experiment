import * as fs from 'fs-jetpack'
import { core } from 'nexus'
import { nexusPrismaPlugin } from 'nexus-prisma'
import * as path from 'path'
import { findProjectDir, trimNodeModulesIfInPath } from './path'

export function createNexusConfig({
  generatedPhotonPackagePath: photonPath,
  contextPath,
}: {
  generatedPhotonPackagePath: string
  contextPath: string
}): Omit<core.SchemaConfig, 'types'> {
  const shouldGenerateArtifacts =
    process.env.PUMPKINS_SHOULD_GENERATE_ARTIFACTS === 'true'
      ? true
      : process.env.PUMPKINS_SHOULD_GENERATE_ARTIFACTS === 'false'
      ? false
      : Boolean(!process.env.NODE_ENV || process.env.NODE_ENV === 'development')
  const shouldExitAfterGenerateArtifacts =
    process.env.PUMPKINS_SHOULD_EXIT_AFTER_GENERATE_ARTIFACTS === 'true'
      ? true
      : false

  return {
    outputs: outputs(),
    typegenAutoConfig: typegenAutoConfig({
      photonPath,
      contextPath,
    }),
    shouldGenerateArtifacts,
    shouldExitAfterGenerateArtifacts,
    plugins: plugins({ photonPath, shouldGenerateArtifacts }),
  }
}

function plugins({
  photonPath,
  shouldGenerateArtifacts,
}: {
  photonPath: string
  shouldGenerateArtifacts: boolean
}): core.NexusPlugin[] | undefined {
  const nexusPrismaTypegenOutput = fs.path(
    'node_modules/@types/nexus-typegen-prisma/index.d.ts'
  )

  return [
    nexusPrismaPlugin({
      inputs: {
        photon: path.relative(nexusPrismaTypegenOutput, photonPath),
      },
      outputs: {
        typegen: nexusPrismaTypegenOutput,
      },
      shouldGenerateArtifacts,
    }),
  ]
}

function outputs(): { typegen: string; schema: string } {
  const projectDir = findProjectDir()
  const defaultSchemaPath = path.join(projectDir, 'schema.graphql')
  // const defaultTypesPath = path.join(pumpkinsDir, 'nexus-typegen.ts')
  const defaultTypesPath = fs.path(
    'node_modules/@types/nexus-typegen/index.d.ts'
  )

  return {
    schema: defaultSchemaPath,
    typegen: defaultTypesPath,
  }
}

function typegenAutoConfig({
  photonPath,
  contextPath,
}: {
  photonPath: string
  contextPath: string
}) {
  return {
    contextType: 'Context.Context',
    sources: [
      { source: contextPath, alias: 'Context' },
      {
        source: trimNodeModulesIfInPath(path.join(photonPath, 'index.d.ts')),
        alias: 'photon',
      },
    ],
  }
}
