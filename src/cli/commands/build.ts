import { stripIndent } from 'common-tags'
import * as fs from 'fs-jetpack'
import ts from 'typescript'
import { START_MODULE_NAME } from '../../constants'
import * as Layout from '../../framework/layout'
import { createStartModuleContent } from '../../framework/start'
import { arg, Command, isError } from '../../lib/cli'
import * as Plugin from '../../lib/plugin'
import {
  compile,
  createTSProgram,
  extractContextTypes,
  fatal,
  findOrScaffoldTsConfig,
  generateArtifacts,
  transpileModule,
} from '../../utils'
import {
  computeBuildOutputFromTarget,
  formattedSupportedDeployTargets,
  logTargetPostBuildMessage,
  normalizeTarget,
  validateTarget,
} from '../../utils/deploy-target'
import { rootLogger } from '../../utils/logger'

const log = rootLogger.child('builder')

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
      log.error(args.stack ?? args.message)
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
    process.env.NEXUS_TYPEGEN_ADD_CONTEXT_RESULTS = JSON.stringify(
      contextFieldTypes
    )

    log.trace('running_typegen')
    log.info('Generating Nexus artifacts ...')
    await generateArtifacts(
      createStartModuleContent({
        internalStage: 'dev',
        appPath: layout.app.path,
        layout,
      })
    )

    log.info('Compiling ...')
    // Recreate our program instance so that it picks up the typegen. We use
    // incremental builder type of program so that the cache from the previous
    // run of TypeScript should make re-building up this one cheap.
    const tsProgramWithTypegen = createTSProgram(layout)
    compile(tsProgramWithTypegen, layout)

    await writeStartModule(args['--stage'] ?? 'production', layout, tsProgram)

    log.info('success', {
      buildOutput: layout.buildOutput,
    })
    if (deploymentTarget) {
      logTargetPostBuildMessage(deploymentTarget)
    }
  }

  help() {
    return stripIndent`
      Usage: nexus build [flags]

      Build a production-ready nexus server

      Flags:
        -o,     --output    Relative path to output directory
        -d, --deployment    Enable custom build for some deployment platforms (${formattedSupportedDeployTargets})
        -h,       --help    Show this help message
    `
  }
}

/**
 * Output to disk in the build the start module that will be used to boot the
 * nexus app.
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
      nexus reserves the source root module name ${START_MODULE_NAME}.js for its own use.
      Please change your app layout to not have this module.
      This is a temporary limitation that we intend to remove in the future. 
      For more details please see this GitHub issue: https://github.com/graphql-nexus/nexus-future/issues/139
    `)
  }

  log.trace('transpiling start module...')
  const startModule = transpileModule(
    createStartModuleContent({
      internalStage: 'build',
      appPath: layout.app.path,
      layout,
      buildStage,
    }),
    tsProgram.getCompilerOptions()
  )
  log.trace('done')

  log.trace('writing start module to disk...')
  await fs.writeAsync(
    fs.path(`${layout.buildOutput}/${START_MODULE_NAME}.js`),
    startModule
  )
  log.trace('done')
}
