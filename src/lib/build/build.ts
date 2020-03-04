import { stripIndent } from 'common-tags'
import * as FS from 'fs-jetpack'
import ts from 'typescript'
import * as Layout from '../../framework/layout'
import { createStartModuleContent } from '../../framework/start'
import {
  compile,
  createTSProgram,
  fatal,
  findOrScaffoldTsConfig,
  generateArtifacts,
  transpileModule,
} from '../../utils'
import { rootLogger } from '../../utils/logger'
import { extractContextTypes } from '../add-to-context-extractor'
import { START_MODULE_NAME } from '../constants'
import { loadAllWorkflowPluginsFromPackageJson } from '../plugin'
import {
  computeBuildOutputFromTarget,
  logTargetPostBuildMessage,
  normalizeTarget,
  validateTarget,
} from './deploy-target'

const log = rootLogger.child('build')

interface BuildSettings {
  target?: string
  output?: string
  stage?: string
}

export async function buildNexusApp(settings: BuildSettings) {
  const deploymentTarget = normalizeTarget(settings.target)

  const layout = await Layout.create({
    buildOutput:
      settings.output ??
      computeBuildOutputFromTarget(deploymentTarget) ??
      undefined,
  })

  if (deploymentTarget) {
    const validatedTarget = validateTarget(deploymentTarget, layout)
    if (!validatedTarget.valid) {
      process.exit(1)
    }
  }

  const plugins = await loadAllWorkflowPluginsFromPackageJson(layout)

  await findOrScaffoldTsConfig(layout)

  for (const p of plugins) {
    await p.hooks.build.onStart?.()
  }

  const tsBuilder = createTSProgram(layout)
  const contextFieldTypes = extractContextTypes(tsBuilder.getProgram())
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

  await writeStartModule(settings.stage ?? 'production', layout, tsBuilder)

  log.info('success', {
    buildOutput: layout.buildOutput,
  })

  if (deploymentTarget) {
    logTargetPostBuildMessage(deploymentTarget)
  }
}

/**
 * Output to disk in the build the start module that will be used to boot the
 * nexus app.
 */
export async function writeStartModule(
  buildStage: string,
  layout: Layout.Layout,
  tsProgram: ts.EmitAndSemanticDiagnosticsBuilderProgram
): Promise<void> {
  // TODO we can be more flexible and allow the user to write an index.ts
  // module. For example we can alias it, or, we can rename it e.g.
  // `index_original.js`. For now we just error out and ask the user to not name
  // their module index.ts.
  if (FS.exists(`${layout.buildOutput}/${START_MODULE_NAME}.js`)) {
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
  await FS.writeAsync(
    FS.path(`${layout.buildOutput}/${START_MODULE_NAME}.js`),
    startModule
  )
  log.trace('done')
}
