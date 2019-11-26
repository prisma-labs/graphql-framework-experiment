// TODO raise errors/feedback if the user has not supplied a photon generator
// block in their PSL

import {
  trimExt,
  pumpkinsPath,
  shouldGenerateArtifacts,
  writePumpkinsFile,
  pog,
  findFiles,
} from '../../utils'
import * as Prisma from '@prisma/sdk'
import chalk from 'chalk'
import * as fs from 'fs-jetpack'
import { nexusPrismaPlugin, Options } from 'nexus-prisma'
import * as path from 'path'
import { suggestionList } from '../../utils/levenstein'
import { printStack } from '../../utils/stack/printStack'
import { Plugin } from '../plugin'

type UnknownFieldName = {
  error: Error
  unknownFieldName: string
  validFieldNames: string[]
  typeName: string
}

type UnknownOutputType = {
  unknownOutputType: string
  error: Error
  typeName: string
  fieldName: string
}

type OptionsWithHook = Options & {
  onUnknownFieldName: (params: UnknownFieldName) => void
  onUnknownOutputType: (params: UnknownOutputType) => void
}

const log = pog.sub(__filename)

// HACK
// 1. https://prisma-company.slack.com/archives/C8AKVD5HU/p1574267904197600
// 2. https://prisma-company.slack.com/archives/CEYCG2MCN/p1574267824465700
const GENERATED_PHOTON_OUTPUT_PATH = fs.path('node_modules/@prisma/photon')

export const createPrismaPlugin: () => Plugin = () => {
  // TODO plugin api for .pumpkins sandboxed fs access
  const generatedContextTypePath = pumpkinsPath('prisma/context.ts')

  writePumpkinsFile(
    generatedContextTypePath.relative,
    `
      import { Photon } from '${GENERATED_PHOTON_OUTPUT_PATH}'
      
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
        return require(trimExt(generatedContextTypePath.absolute, '.ts'))
          .context
      },
      typeSourcePath: generatedContextTypePath.absolute,
      typeExportName: 'Context',
    },
    nexus: {
      plugins: [
        nexusPrismaPlugin({
          inputs: {
            photon: GENERATED_PHOTON_OUTPUT_PATH,
          },
          outputs: {
            typegen: nexusPrismaTypegenOutput,
          },
          shouldGenerateArtifacts: shouldGenerateArtifacts(),
          onUnknownFieldName: params => renderUnknownFieldNameError(params),
          onUnknownOutputType: params => renderUnknownOutputTypeError(params),
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
      : chalk`{yellow Warning:} Did you mean ${suggestions
          .map(s => `"${s}"`)
          .join(', ')} ?`
  const intro = chalk`{yellow Warning:} ${params.error.message}\n{yellow Warning:} in ${fileLineNumber}\n${suggestionMessage}`

  console.log(`${intro}${stack}`)
}

function renderUnknownOutputTypeError(params: UnknownOutputType) {
  const { stack, fileLineNumber } = printStack({
    callsite: params.error.stack,
  })

  const intro = chalk`{yellow Warning:} ${params.error.message}\n{yellow Warning:} in ${fileLineNumber}`

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

/**
 * Check the project to find out if the user intends prisma to be enabled or
 * not.
 */
export async function isPrismaEnabled(): Promise<
  | {
      enabled: false
    }
  | {
      enabled: true
      schemaPath: string
    }
> {
  const schemaPath = await maybeFindPrismaSchema()

  if (schemaPath === null) {
    log('detected that this is not prisma framework project')
    return { enabled: false }
  }

  log('detected that this is a prisma framework project')
  return { enabled: true, schemaPath: fs.path(schemaPath) }
}

/**
 * Find the PSL file in the project. If multiple are found a warning is logged.
 */
const maybeFindPrismaSchema = async (): Promise<null | string> => {
  const schemaPaths = await findFiles('schema.prisma', {
    ignore: ['prisma/migrations/**/*'],
  })

  if (schemaPaths.length > 1) {
    console.warn(
      `Warning: we found multiple "schema.prisma" files in your project.\n${schemaPaths
        .map((p, i) => `- \"${p}\"${i === 0 ? ' (used by pumpkins)' : ''}`)
        .join('\n')}`
    )
  }

  return schemaPaths[0] ?? null
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

/**
 * Execute all the generators in the user's PSL file.
 */
export async function runPrismaGenerators(
  options: { silent: boolean } = { silent: false }
): Promise<void> {
  const prisma = await isPrismaEnabled()

  if (!prisma.enabled) {
    return
  }

  // TODO Do not assume that just because photon does not need to be regenerated that no other generators do
  if ((await shouldRegeneratePhoton(prisma.schemaPath)) === false) {
    log(
      'Prisma generators were not run because the prisma schema was not updated'
    )
    return
  }

  if (!options.silent) {
    console.log('🎃  Running Prisma generators ...')
  }

  const generators = await getGenerators(prisma.schemaPath)

  for (const g of generators) {
    const resolvedSettings = getGeneratorResolvedSettings(g)

    log(
      'generating %s instance %s to %s',
      resolvedSettings.name,
      resolvedSettings.instanceName,
      resolvedSettings.output
    )

    await g.generate()
    g.stop()
  }
}

/**
 * Get the declared generator blocks in the user's PSL file
 */
const getGenerators = async (schemaPath: string) => {
  const aliases = {
    photonjs: {
      // HACK (see var declaration LOC)
      outputPath: GENERATED_PHOTON_OUTPUT_PATH,
      generatorPath: require.resolve('@prisma/photon/generator-build'),
    },
  }

  return await Prisma.getGenerators({
    schemaPath,
    printDownloadProgress: false,
    providerAliases: aliases,
  })
}

/**
 * Compute the resolved settings of a generator which has its baked in manifest
 * but also user-provided overrides. This computes the merger of the two.
 */
const getGeneratorResolvedSettings = (
  g: Prisma.Generator
): {
  name: string
  instanceName: string
  output: string
} => {
  return {
    name: g.manifest?.prettyName ?? '',
    instanceName: g.options?.generator.name ?? '',
    output: g.options?.generator.output ?? g.manifest?.defaultOutput ?? '',
  }
}

// const getPhotonGeneratorOutputPath = (
//   generators: Prisma.Generator[]
// ): string => {
//   for (const g of generators) {
//     const settings = getGeneratorResolvedSettings(g)
//     if (settings.name === 'Photon.js') {
//       return settings.output
//     }
//   }

//   // TODO we can automate this for the user...
//   throw new Error(
//     'Could not find a Photon.js generator block in your PSL. Please define one.'
//   )
// }

/**
 * Regenerate photon only if schema was updated between last generation
 */
async function shouldRegeneratePhoton(
  localSchemaPath: string
): Promise<boolean> {
  const photonSchemaPath = path.join(
    GENERATED_PHOTON_OUTPUT_PATH,
    'schema.prisma'
  )

  log(
    "checking if photon needs to be regenerated by comparing users PSL to photon's local copy...\n%s\n%s",
    photonSchemaPath,
    localSchemaPath
  )

  const [photonSchema, localSchema] = await Promise.all([
    fs.readAsync(photonSchemaPath),
    fs.readAsync(localSchemaPath),
  ])

  if (photonSchema !== undefined && localSchema !== undefined) {
    log('...found photon and its local version of PSL')
    if (photonSchema === localSchema) {
      log(
        "...found that its local PSL version matches user's current, will NOT regenerate photon"
      )
      return false
    } else {
      log(
        "...found that its local PSL version does not match user's current, WILL regenerate photon"
      )
      return true
    }
  } else {
    log('...did not find generated photon package or its local copy of PSL')
    return true
  }
}
