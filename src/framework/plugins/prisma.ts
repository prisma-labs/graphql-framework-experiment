// TODO raise errors/feedback if the user has not supplied a photon generator
// block in their PSL

import * as proc from '../../utils/process'
import * as Prisma from '@prisma/sdk'
import chalk from 'chalk'
import * as fs from 'fs-jetpack'
import { nexusPrismaPlugin, Options } from 'nexus-prisma'
import * as path from 'path'
import { findFiles, pog, run } from '../../utils'
import { suggestionList } from '../../utils/levenstein'
import { printStack } from '../../utils/stack/printStack'
import { shouldGenerateArtifacts } from '../nexus'
import { Plugin } from '../plugin'
import { stripIndent } from 'common-tags'

type UnknownFieldName = {
  error: Error
  unknownFieldName: string
  validFieldNames: string[]
  typeName: string
}

export type UnknownFieldType = {
  unknownFieldType: string
  error: Error
  typeName: string
  fieldName: string
}

type OptionsWithHook = Options & {
  onUnknownFieldName: (params: UnknownFieldName) => void
  onUnknownFieldType: (params: UnknownFieldType) => void
}

const log = pog.sub(__filename)

// HACK
// 1. https://prisma-company.slack.com/archives/C8AKVD5HU/p1574267904197600
// 2. https://prisma-company.slack.com/archives/CEYCG2MCN/p1574267824465700
const GENERATED_PHOTON_OUTPUT_PATH = fs.path('node_modules/@prisma/photon')

export const createPrismaPlugin: () => Plugin = () => {
  const nexusPrismaTypegenOutput = fs.path(
    'node_modules/@types/typegen-nexus-prisma/index.d.ts'
  )

  return {
    name: 'prisma',
    workflow: {
      async onBuildStart() {
        await runPrismaGenerators()
      },
      async onDevStart() {
        await runPrismaGenerators()
      },
      async onCreateAfterScaffold(pumpkins) {
        // TODO augment package.json to include pumpkins-plugin-prisma
        await Promise.all([
          fs.writeAsync(
            'prisma/schema.prisma',
            stripIndent`
              datasource db {
                provider = "sqlite"
                url      = "file:dev.db"
              }
      
              generator photon {
                provider = "photonjs"
              }
      
              model World {
                id         Int     @id
                name       String  @unique
                population Float
              }
            `
          ),

          fs.writeAsync(
            'prisma/seed.ts',
            stripIndent`
              import { Photon } from "@prisma/photon"
      
              const photon = new Photon()
              
              main()
              
              async function main() {
                const result = await photon.worlds.create({
                  data: {
                    name: "Earth",
                    population: 6_000_000_000
                  }
                })
              
                console.log("Seeded: %j", result)
              
                photon.disconnect()
              }
            `
          ),

          fs.writeAsync(
            pumpkins.layout.sourcePath('schema.ts'),
            stripIndent`
              import { app } from "pumpkins"
              import { stringArg } from "nexus"
      
              app.objectType({
                name: "World",
                definition(t) {
                  t.model.id()
                  t.model.name()
                  t.model.population()
                }
              })
      
              app.queryType({
                definition(t) {
                  t.field("hello", {
                    type: "World",
                    args: {
                      world: stringArg({ required: false })
                    },
                    async resolve(_root, args, ctx) {
                      const worldToFindByName = args.world ?? 'Earth'
                      const world = await ctx.photon.worlds.findOne({
                        where: {
                          name: worldToFindByName
                        }
                      })
      
                      if (!world) throw new Error(\`No such world named "\${args.world}"\`)
      
                      return world
                    }
                  })
                }
              })
            `
          ),
        ])
      },
      async onCreateAfterDepInstall(pumpkins) {
        pumpkins.log('initializing development database...')
        await proc.run('yarn -s prisma2 lift save --create-db --name init')
        await proc.run('yarn -s prisma2 lift up')

        pumpkins.log('seeding data...')
        await proc.run('yarn -s ts-node prisma/seed')
      },
      async onGenerateStart() {
        await runPrismaGenerators()
      },
      onDevFileWatcherEvent(event, file) {
        if (file.match(/.*schema\.prisma$/)) {
          console.log(
            chalk`{bgBlue INFO} Prisma Schema change detected, lifting...`
          )
          onDevModePrismaSchemaChange()
        }
      },
      // TODO preferably we allow schema.prisma to be anywhere but they show up in
      // migrations folder too and we don't know how to achieve semantic "anywhere
      // but migrations folder"
      watchFilePatterns: ['./schema.prisma', './prisma/schema.prisma'],
    },
    runtime: {
      onInstall() {
        const { Photon } = require('@prisma/photon')
        const photon = new Photon()

        return {
          context: {
            create: _req => {
              return { photon }
            },
            typeGen: {
              imports: [{ as: 'Photon', from: GENERATED_PHOTON_OUTPUT_PATH }],
              fields: {
                photon: 'Photon.Photon',
              },
            },
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
                onUnknownFieldName: params =>
                  renderUnknownFieldNameError(params),
                onUnknownFieldType: params =>
                  renderUnknownFieldTypeError(params),
              } as OptionsWithHook),
            ],
          },
        }
      },
    },
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

function renderUnknownFieldTypeError(params: UnknownFieldType) {
  const { stack, fileLineNumber } = printStack({
    callsite: params.error.stack,
  })

  const intro = chalk`{yellow Warning:} ${params.error.message}\n{yellow Warning:} in ${fileLineNumber}`

  console.log(`${intro}${stack}`)
}

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

export async function onDevModePrismaSchemaChange() {
  // Raw code being run is this https://github.com/prisma/lift/blob/dce60fe2c44e8a0d951d961187aec95a50a33c6f/src/cli/commands/LiftTmpPrepare.ts#L33-L45
  log('running lift...')
  const result = run('prisma2 tmp-prepare', { require: true })
  log('done %O', result)
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

  let generators = await getGenerators(prisma.schemaPath)

  if (!generators.find(g => g.options?.generator.provider === 'photonjs')) {
    await scaffoldPhotonGeneratorBlock(prisma.schemaPath)
    // TODO: Generate it programmatically instead for performance reason
    generators = await getGenerators(prisma.schemaPath)
  }

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

async function scaffoldPhotonGeneratorBlock(schemaPath: string) {
  console.log(`\
${chalk.yellow(
  'Warning:'
)} A PhotonJS generator block is needed in your Prisma Schema at "${path.relative(
    process.cwd(),
    schemaPath
  )}".
${chalk.yellow('Warning:')} We scaffolded one for you.
`)
  const schemaContent = await fs.readAsync(schemaPath)!
  const generatorBlock = `\
generator photon {
  provider = "photonjs"
}
`
  await fs.writeAsync(schemaPath, `${generatorBlock}\n${schemaContent}`)
}
