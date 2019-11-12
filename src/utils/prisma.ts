import { getGenerators } from '@prisma/sdk'
import * as path from 'path'
import * as fs from 'fs-jetpack'

export function isPrismaEnabled() {
  const schemaPath = fs.find({
    directories: false,
    recursive: true,
    matching: [
      'schema.prisma',
      '!node_modules/**/*',
      '!prisma/migrations/**/*',
    ],
  })

  if (!schemaPath) {
    return { enabled: false }
  }

  return { enabled: true, schemaPath: fs.path(schemaPath[0]) }
}
export async function runPrismaGenerators(
  options: { silent: boolean } = { silent: false }
) {
  const { enabled, schemaPath } = isPrismaEnabled()

  if (!enabled) {
    return
  }

  if (!(await shouldRegeneratePhoton(schemaPath!))) {
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
async function shouldRegeneratePhoton(localSchemaPath: string) {
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
