import { Plugin } from '../plugin'
import * as fs from 'fs-jetpack'
import { trimExt, pumpkinsPath, shouldGenerateArtifacts } from '../../utils'
import { nexusPrismaPlugin } from 'nexus-prisma'
import { getGenerators } from '@prisma/sdk'
import * as path from 'path'
import { log as pumpkinsLog } from '../../utils/log'

const log = pumpkinsLog.create('prisma')

export const createPrismaPlugin: () => Plugin = () => {
  // TODO control generate step before trying to require
  const generatedPhotonPackagePath = fs.path('node_modules/@generated/photon')

  // TODO plugin api for .pumpkins sandboxed fs access
  const generatedContextTypePath = pumpkinsPath('prisma/context.ts')

  fs.write(
    generatedContextTypePath,
    `
      import { Photon } from '${generatedPhotonPackagePath}'
      
      export type Context = {
        photon: Photon
      }
      
      export const createContext: Context = {
        photon: new Photon(),
      }
    `
  )

  const nexusPrismaTypegenOutput = fs.path(
    'node_modules/@types/nexus-typegen-prisma/index.d.ts'
  )

  return {
    name: 'prisma',
    context: {
      create: _req => {
        return require(trimExt(generatedContextTypePath, '.ts'))
      },
      typeSourcePath: generatedContextTypePath,
      typeExportName: 'Context',
    },
    nexus: {
      plugins: [
        nexusPrismaPlugin({
          inputs: {
            photon: generatedPhotonPackagePath,
          },
          outputs: {
            typegen: nexusPrismaTypegenOutput,
          },
          shouldGenerateArtifacts: shouldGenerateArtifacts(),
        }),
      ],
    },
    onBuild() {},
  }
}

// plugin()
//   .onDevStart(() => {
//     // generate prisma
//   })
//   .onBuildStart(() => {
//     // generate prisma
//   })
//   .onInstall(() => {
//   })

// plugin((hooks) => {
//   hooks.onDevStart(() => {})
//   hooks.onBuildStart(() => {})
//   // hooks.onInstall(() => {})

//   return {
//     name: 'prisma',
//     context: {
//       create: _req => {
//         return { photon }
//       },
//       typeSourcePath: generatedContextTypePath,
//       typeExportName: 'Context',
//     },
//   }
// })

export async function isPrismaEnabled(): Promise<
  | {
      enabled: false
    }
  | {
      enabled: true
      schemaPath: string
    }
> {
  const schemaPaths = await fs.findAsync({
    directories: false,
    recursive: true,
    matching: [
      'schema.prisma',
      '!node_modules/**/*',
      '!prisma/migrations/**/*',
    ],
  })

  if (schemaPaths.length > 1) {
    console.warn(
      `Warning: we found multiple "schema.prisma" files in your project.\n${schemaPaths
        .map((p, i) => `- \"${p}\"${i === 0 ? ' (used by pumpkins)' : ''}`)
        .join('\n')}`
    )
  }

  if (schemaPaths.length === 0) {
    return { enabled: false }
  }

  return { enabled: true, schemaPath: fs.path(schemaPaths[0]) }
}

export async function runPrismaGenerators(
  options: { silent: boolean } = { silent: false }
): Promise<void> {
  const prisma = await isPrismaEnabled()

  if (!prisma.enabled) {
    return
  }

  if ((await shouldRegeneratePhoton(prisma.schemaPath)) === false) {
    log(
      'Prisma generators were not run because the prisma schema was not updated'
    )
    return
  }

  if (!options.silent) {
    console.log('🎃  Running Prisma generators ...')
  }

  const aliases = {
    photonjs: require.resolve('@prisma/photon/generator-build'),
  }

  const generators = await getGenerators({
    schemaPath: prisma.schemaPath,
    printDownloadProgress: false,
    providerAliases: aliases,
  })

  for (const generator of generators) {
    await generator.generate()
    generator.stop()
  }
}

/**
 * Regenerate photon only if schema was updated between last generation
 */
async function shouldRegeneratePhoton(
  localSchemaPath: string
): Promise<boolean> {
  try {
    // TODO: Use path from generator because photon can be generated elsewhere than at @generated/photon
    const photonPath = require.resolve('@generated/photon')
    const photonSchemaPath = path.join(
      path.dirname(photonPath),
      'schema.prisma'
    )
    const [photonSchema, localSchema] = await Promise.all([
      fs.readAsync(photonSchemaPath),
      fs.readAsync(localSchemaPath),
    ])

    if (photonSchema && localSchema && photonSchema === localSchema) {
      return false
    }

    return true
  } catch {
    return true
  }
}
