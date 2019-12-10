import { stripIndent } from 'common-tags'
import * as fs from 'fs-jetpack'
import ts from 'typescript'
import { BUILD_FOLDER_NAME, START_MODULE_NAME } from '../../constants'
import * as Layout from '../../framework/layout'
import { createStartModuleContent } from '../../framework/start'
import {
  compile,
  createTSProgram,
  extractContextTypes,
  fatal,
  findOrScaffoldTsConfig,
  generateArtifacts,
  pog,
  transpileModule,
} from '../../utils'
import {
  computeOutputBuildFromTarget,
  logTargetPostBuildMessage,
  normalizeTarget,
  validateTarget,
} from '../../utils/deploy-target'
import { logger } from '../../utils/logger'
import { arg, Command, isError } from '../helpers'
import { loadPlugins } from '../helpers/utils'

const log = pog.sub('cli:build')

const BUILD_ARGS = {
  '--output': String,
  '-o': '--output',
  '--deployment': String,
  '-d': '--deployment',
  '--help': Boolean,
  '-h': '--help',
}

type Args = typeof BUILD_ARGS

export class Build implements Command {
  async parse(argv: string[]) {
    const args = arg(argv, BUILD_ARGS)

    if (isError(args)) {
      logger.error(args.stack ?? args.message)
      return this.help()
    }

    if (args['--help']) {
      return this.help()
    }

    const plugins = await loadPlugins()
    const layout = await Layout.create()

    const deploymentTarget = normalizeTarget(args['--deployment'])
    const outDir =
      args['--output'] ??
      computeOutputBuildFromTarget(deploymentTarget) ??
      BUILD_FOLDER_NAME

    if (deploymentTarget) {
      if (!validateTarget(deploymentTarget, layout, outDir)) {
        process.exit(1)
      }
    }

    await findOrScaffoldTsConfig(layout, outDir)

    for (const p of plugins) {
      await p.onBuildStart?.()
    }

    const tsProgram = createTSProgram(layout, outDir)
    const contextFieldTypes = extractContextTypes(tsProgram)
    process.env.PUMPKINS_TYPEGEN_ADD_CONTEXT_RESULTS = JSON.stringify(
      contextFieldTypes
    )

    log('running typegen')
    console.log('🎃  Generating Nexus artifacts ...')
    await generateArtifacts(
      createStartModuleContent({
        stage: 'dev',
        appPath: layout.app.path,
        layout,
      })
    )

    log('compiling app...')
    console.log('🎃  Compiling ...')
    // Recreate our program instance so that it picks up the typegen. We use
    // incremental builder type of program so that the cache from the previous
    // run of TypeScript should make re-building up this one cheap.
    const tsProgramWithTypegen = createTSProgram(layout, outDir)
    compile(tsProgramWithTypegen, outDir)

    await writeStartModule(layout, tsProgram, outDir)

    console.log('🎃  Pumpkins app successfully compiled at %s', outDir)
    if (deploymentTarget) {
      logTargetPostBuildMessage(deploymentTarget)
    }
  }

  help() {
    return stripIndent`
      Usage: pumpkins build [flags]

      Build a production-ready pumpkins server

      Flags:
        -o,     --output    Relative path to output directory
        -d, --deployment    Enable custom build for some deployment platforms ("now")
        -h,       --help    Show this help message
    `
  }
}

/**
 * Output to disk in the build the start module that will be used to boot the
 * pumpkins app.
 */
async function writeStartModule(
  layout: Layout.Layout,
  tsProgram: ts.EmitAndSemanticDiagnosticsBuilderProgram,
  outputBuild: string
): Promise<void> {
  // TODO we can be more flexible and allow the user to write an index.ts
  // module. For example we can alias it, or, we can rename it e.g.
  // `index_original.js`. For now we just error out and ask the user to not name
  // their module index.ts.
  if (fs.exists(`${outputBuild}/${START_MODULE_NAME}.js`)) {
    fatal(stripIndent`
      Pumpkins reserves the source root module name ${START_MODULE_NAME}.js for its own use.
      Please change your app layout to not have this module.
      This is a temporary limitation that we intend to remove in the future. 
      For more details please see this GitHub issue: https://github.com/prisma/pumpkins/issues/139
    `)
  }

  log('transpiling start module...')
  const startModule = transpileModule(
    createStartModuleContent({
      stage: 'build',
      appPath: layout.app.path,
      layout,
    }),
    tsProgram.getCompilerOptions()
  )
  log('done')

  log('writing start module to disk...')
  await fs.writeAsync(
    fs.path(`${outputBuild}/${START_MODULE_NAME}.js`),
    startModule
  )
  log('done')
}
