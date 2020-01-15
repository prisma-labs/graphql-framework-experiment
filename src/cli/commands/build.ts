import { stripIndent } from 'common-tags'
import * as fs from 'fs-jetpack'
import ts from 'typescript'
import { START_MODULE_NAME } from '../../constants'
import * as Layout from '../../framework/layout'
import * as Plugin from '../../framework/plugin'
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
  computeBuildOutputFromTarget,
  formattedSupportedDeployTargets,
  logTargetPostBuildMessage,
  normalizeTarget,
  validateTarget,
} from '../../utils/deploy-target'
import { logger } from '../../utils/logger'
import { arg, Command, isError } from '../helpers'

const log = pog.sub('cli:build')

const BUILD_ARGS = {
  '--output': String,
  '-o': '--output',
  '--deployment': String,
  '-d': '--deployment',
  '--stage': String,
  '--help': Boolean,
  '-h': '--help',
}

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

    const deploymentTarget = normalizeTarget(args['--deployment'])
    const layout = await Layout.create({
      buildOutput:
        args['--output'] ??
        computeBuildOutputFromTarget(deploymentTarget) ??
        undefined,
    })

    if (deploymentTarget) {
      const validatedTarget = validateTarget(deploymentTarget, layout)
      if (!validatedTarget.valid) {
        process.exit(1)
      }
    }
    const plugins = await Plugin.loadAllWorkflowPluginsFromPackageJson(layout)

    await findOrScaffoldTsConfig(layout)

    for (const p of plugins) {
      await p.hooks.build.onStart?.()
    }

    const tsProgram = createTSProgram(layout)
    const contextFieldTypes = extractContextTypes(tsProgram)
    process.env.GRAPHQL_SANTA_TYPEGEN_ADD_CONTEXT_RESULTS = JSON.stringify(
      contextFieldTypes
    )

    log('running typegen')
    console.log('Generating Nexus artifacts ...')
    await generateArtifacts(
      createStartModuleContent({
        internalStage: 'dev',
        appPath: layout.app.path,
        layout,
      })
    )

    log('compiling app...')
    console.log('Compiling ...')
    // Recreate our program instance so that it picks up the typegen. We use
    // incremental builder type of program so that the cache from the previous
    // run of TypeScript should make re-building up this one cheap.
    const tsProgramWithTypegen = createTSProgram(layout)
    compile(tsProgramWithTypegen, layout)

    await writeStartModule(args['--stage'] ?? 'production', layout, tsProgram)

    console.log(
      'graphql-santa app successfully compiled at %s',
      layout.buildOutput
    )
    if (deploymentTarget) {
      logTargetPostBuildMessage(deploymentTarget)
    }
  }

  help() {
    return stripIndent`
      Usage: graphql-santa build [flags]

      Build a production-ready graphql-santa server

      Flags:
        -o,     --output    Relative path to output directory
        -d, --deployment    Enable custom build for some deployment platforms (${formattedSupportedDeployTargets})
        -h,       --help    Show this help message
    `
  }
}

/**
 * Output to disk in the build the start module that will be used to boot the
 * graphql-santa app.
 */
async function writeStartModule(
  buildStage: string,
  layout: Layout.Layout,
  tsProgram: ts.EmitAndSemanticDiagnosticsBuilderProgram
): Promise<void> {
  // TODO we can be more flexible and allow the user to write an index.ts
  // module. For example we can alias it, or, we can rename it e.g.
  // `index_original.js`. For now we just error out and ask the user to not name
  // their module index.ts.
  if (fs.exists(`${layout.buildOutput}/${START_MODULE_NAME}.js`)) {
    fatal(stripIndent`
      graphql-santa reserves the source root module name ${START_MODULE_NAME}.js for its own use.
      Please change your app layout to not have this module.
      This is a temporary limitation that we intend to remove in the future. 
      For more details please see this GitHub issue: https://github.com/prisma-labs/graphql-santa/issues/139
    `)
  }

  log('transpiling start module...')
  const startModule = transpileModule(
    createStartModuleContent({
      internalStage: 'build',
      appPath: layout.app.path,
      layout,
      buildStage,
    }),
    tsProgram.getCompilerOptions()
  )
  log('done')

  log('writing start module to disk...')
  await fs.writeAsync(
    fs.path(`${layout.buildOutput}/${START_MODULE_NAME}.js`),
    startModule
  )
  log('done')
}
