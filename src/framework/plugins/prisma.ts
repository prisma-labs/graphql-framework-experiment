import { getGenerators } from '@prisma/sdk'
import chalk from 'chalk'
import * as fs from 'fs-jetpack'
import { nexusPrismaPlugin, Options } from 'nexus-prisma'
import * as path from 'path'
import { pumpkinsPath, shouldGenerateArtifacts, trimExt } from '../../utils'
import { suggestionList } from '../../utils/levenstein'
import { log as pumpkinsLog } from '../../utils/log'
import { printStack } from '../../utils/stack/printStack'
import { Plugin } from '../plugin'

type UnknownFieldName = {
  error: Error
  unknownFieldName: string
  validFieldNames: string[]
  typeName: string
}

type OptionsWithHook = Options & {
  onUnknownFieldName: (params: UnknownFieldName) => void
}

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
      
      export const context: Context = {
        photon: new Photon(),
      }
    `
  )

  const nexusPrismaTypegenOutput = fs.path(
    'node_modules/@types/typegen-nexus-prisma/index.d.ts'
  )

  return {
    name: 'prisma',
    context: {
      create: _req => {
        return require(trimExt(generatedContextTypePath, '.ts')).context
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
          onUnknownFieldName: params => renderUnknownFieldNameError(params),
        } as OptionsWithHook),
      ],
    },
    onBuild() {},
  }
}

function renderUnknownFieldNameError(params: UnknownFieldName) {
  const { stack, fileLineNumber } = printStack({
    callsite: params.error.stack,
  })
  const suggestions = suggestionList(
    params.unknownFieldName,
    params.validFieldNames
  ).map(s => chalk.green(s))
  const suggestionMessage =
    suggestions.length === 0
      ? ''
      : `Did you mean ${suggestions.map(s => `"${s}"`).join(', ')} ?`
  const intro = chalk`{yellow Warning:} ${params.error.message}\n{yellow Warning:} in ${fileLineNumber}\n{yellow Warning:} ${suggestionMessage}`

  console.log(`${intro}${stack}`)
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
    log('detected that this is not prisma framework project')
    return { enabled: false }
  }

  log('detected that this is a prisma framework project')
  return { enabled: true, schemaPath: fs.path(schemaPaths[0]) }
}

export function isPrismaEnabledSync():
  | {
      enabled: false
    }
  | {
      enabled: true
      schemaPath: string
    } {
  const schemaPaths = fs.find({
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
    log('detected that this is not prisma framework project')
    return { enabled: false }
  }

  log('detected that this is a prisma framework project')
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
