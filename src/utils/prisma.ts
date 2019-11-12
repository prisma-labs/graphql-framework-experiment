import { getGenerators } from '@prisma/sdk'
import * as path from 'path'
import * as fs from 'fs-jetpack'
import { debug } from './debug'

export async function isPrismaEnabled(): Promise<
  | {
      enabled: boolean
      schemaPath?: undefined
    }
  | {
      enabled: boolean
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
    console.log(
      `Warning: we found multiple "schema.prisma" files in your project.\n${schemaPaths
        .map((p, i) => `- \"${p}\"${i === 0 ? ' (used by pumpkins)' : ''}`)
        .join('\n')}`
    )
  }

  if (!schemaPaths) {
    return { enabled: false }
  }

  return { enabled: true, schemaPath: fs.path(schemaPaths[0]) }
}
export async function runPrismaGenerators(
  options: { silent: boolean } = { silent: false }
): Promise<void> {
  const { enabled, schemaPath } = await isPrismaEnabled()

  if (!enabled) {
    return
  }

  if ((await shouldRegeneratePhoton(schemaPath!)) === false) {
    debug.prisma('Prisma generators were not run because the prisma schema was not updated')
    return
  }

  if (!options.silent) {
    console.log('🎃  Running Prisma generators ...')
  }

  const aliases = {
    photonjs: require.resolve('@prisma/photon/generator-build'),
  }

  const generators = await getGenerators({
    schemaPath: schemaPath!,
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
