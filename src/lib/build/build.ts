import { stripIndent } from 'common-tags'
import * as FS from 'fs-jetpack'
import * as Layout from '../../lib/layout'
import { compile, createTSProgram, deleteTSIncrementalFile } from '../../lib/tsc'
import {
  createStartModuleContent,
  prepareStartModule,
  START_MODULE_NAME,
} from '../../runtime/start/start-module'
import { runAddToContextExtractorAsPromise } from '../add-to-context-extractor/add-to-context-extractor'
import { rootLogger } from '../nexus-logger'
import * as Plugin from '../plugin'
import { fatal } from '../process'
import { generateArtifacts } from './artifact-generation'
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
  process.env.NEXUS_BUILD = 'true'

  const startTime = Date.now()
  const deploymentTarget = normalizeTarget(settings.target)

  const layout = await Layout.create({
    buildOutputRelative: settings.output ?? computeBuildOutputFromTarget(deploymentTarget) ?? undefined,
  })

  /**
   * Delete the TS incremental file to make sure we're building from a clean slate
   */
  deleteTSIncrementalFile(layout)

  if (deploymentTarget) {
    const validatedTarget = validateTarget(deploymentTarget, layout)
    if (!validatedTarget.valid) {
      process.exit(1)
    }
  }

  const manifests = await Plugin.readAllPluginManifestsFromConfig(layout)
  const plugins = await Plugin.loadWorktimePluginFromManifests(manifests, layout)

  for (const p of plugins) {
    await p.hooks.build.onStart?.()
  }

  let tsBuilder
  tsBuilder = createTSProgram(layout, { withCache: true })

  log.trace('Compiling a development build for typegen')

  tsBuilder.emit()

  await writeStartModule({
    layout: layout,
    startModule: prepareStartModule(
      tsBuilder,
      createStartModuleContent({
        plugins: manifests,
        internalStage: 'build',
        layout: layout,
      })
    ),
  })

  log.info('Running typegen & extracting types from addToContext calls')

  await Promise.all([
    runAddToContextExtractorAsPromise(tsBuilder.getProgram()).catch((error) => {
      log.fatal('failed to extract context types', { error })
      process.exit(1)
    }),
    generateArtifacts(layout).catch((error) => {
      log.fatal('failed to generate artifacts', { error })
      process.exit(1)
    }),
  ])

  log.info('Compiling a production build')

  // Recreate our program instance so that it picks up the typegen. We use
  // incremental builder type of program so that the cache from the previous
  // run of TypeScript should make re-building up this one cheap.
  tsBuilder = createTSProgram(layout, { withCache: true })

  compile(tsBuilder, layout, { removePreviousBuild: false })

  await writeStartModule({
    layout: layout,
    startModule: prepareStartModule(
      tsBuilder,
      createStartModuleContent({
        internalStage: 'build',
        layout: layout,
        plugins: manifests,
        disableArtifactGeneration: true,
      })
    ),
  })

  log.info('success', {
    buildOutput: layout.buildOutputRelative,
    time: Date.now() - startTime,
  })

  if (deploymentTarget) {
    logTargetPostBuildMessage(deploymentTarget)
  }
  delete process.env.NEXUS_BUILD
}

/**
 * Output to disk in the build the start module that will be used to boot the
 * nexus app.
 */
export async function writeStartModule({
  startModule,
  layout,
}: {
  startModule: string
  layout: Layout.Layout
}): Promise<void> {
  // TODO we can be more flexible and allow the user to write an index.ts
  // module. For example we can alias it, or, we can rename it e.g.
  // `index_original.js`. For now we just error out and ask the user to not name
  // their module index.ts.
  if (FS.exists(layout.startModuleInPath)) {
    fatal(stripIndent`
      Found ${layout.startModuleInPath}
      Nexus reserves the source root module name ${START_MODULE_NAME}.js for its own use.
      Please change your app layout to not have this module.
      This is a temporary limitation that we intend to remove in the future. 
      For more details please see this GitHub issue: https://github.com/graphql-nexus/nexus/issues/139
    `)
  }

  log.trace('Writing start module to disk')
  await FS.writeAsync(layout.startModuleOutPath, startModule)
}
