import { rightOrThrow } from '@nexus/logger/dist/utils'
import { stripIndent } from 'common-tags'
import * as FS from 'fs-jetpack'
import * as Path from 'path'
import * as Layout from '../../lib/layout'
import { createTSProject, deleteTSIncrementalFile, emitTSProgram } from '../../lib/tsc'
import {
  createStartModuleContent,
  prepareStartModule,
  START_MODULE_NAME,
} from '../../runtime/start/start-module'
import { rootLogger } from '../nexus-logger'
import * as Plugin from '../plugin'
import { fatal } from '../process'
import * as Reflection from '../reflection'
import { rightOrFatal } from '../utils'
import { bundle } from './bundle'
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
  entrypoint?: string
  asBundle: boolean
  cwd?: string
}

export async function buildNexusApp(settings: BuildSettings) {
  process.env.NEXUS_BUILD = 'true'

  const startTime = Date.now()
  const deploymentTarget = normalizeTarget(settings.target)
  const buildOutput = settings.output ?? computeBuildOutputFromTarget(deploymentTarget) ?? undefined

  const layout = rightOrFatal(
    await Layout.create({
      buildOutputDir: buildOutput,
      asBundle: settings.asBundle,
      entrypointPath: settings.entrypoint,
      projectRoot: settings.cwd,
    })
  )

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

  log.info('get used plugins')

  const pluginReflection = await Reflection.reflect(layout, { usedPlugins: true, onMainThread: true })

  if (!pluginReflection.success) {
    fatal('failed to get used plugins', { error: pluginReflection.error })
  }

  const { plugins } = pluginReflection
  const worktimePlugins = Plugin.importAndLoadWorktimePlugins(plugins, layout)

  for (const p of worktimePlugins) {
    await p.hooks.build.onStart?.()
  }

  log.info('starting reflection')

  const reflectionResult = await Reflection.reflect(layout, { artifacts: true })

  if (!reflectionResult.success) {
    fatal('reflection failed', { error: reflectionResult.error })
  }

  log.info('building typescript program')

  const tsProject = rightOrThrow(createTSProject(layout, { withCache: true }))

  log.info('compiling a production build')

  // Recreate our program instance so that it picks up the typegen. We use
  // incremental builder type of program so that the cache from the previous
  // run of TypeScript should make re-building up this one cheap.

  emitTSProgram(tsProject, layout, { removePreviousBuild: false })

  const gotManifests = Plugin.getPluginManifests(plugins)

  if (gotManifests.errors) Plugin.showManifestErrorsAndExit(gotManifests.errors)

  const runtimePluginManifests = gotManifests.data.filter((pm) => pm.runtime)

  if (!layout.tsConfig.content.options.noEmit) {
    await writeStartModule({
      layout: layout,
      startModule: prepareStartModule(
        tsProject,
        createStartModuleContent({
          internalStage: 'build',
          layout: layout,
          runtimePluginManifests,
        })
      ),
    })

    if (layout.build.bundleOutputDir) {
      log.info('bundling app')
      await bundle({
        base: layout.projectRoot,
        bundleOutputDir: layout.build.bundleOutputDir,
        entrypoint: layout.build.startModuleOutPath,
        tsOutputDir: layout.build.tsOutputDir,
        tsRootDir: layout.tsConfig.content.options.rootDir!,
        plugins: pluginReflection.plugins,
      })
      await FS.removeAsync(layout.build.tsOutputDir)
    }
  }

  const buildOutputLog =
    layout.tsConfig.content.options.noEmit === true
      ? 'no emit'
      : Path.relative(layout.projectRoot, layout.build.bundleOutputDir ?? layout.build.tsOutputDir)

  log.info('success', {
    buildOutput: buildOutputLog,
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
  if (FS.exists(layout.build.startModuleInPath)) {
    fatal(stripIndent`
      Found ${layout.build.startModuleInPath}
      Nexus reserves the source root module name ${START_MODULE_NAME}.js for its own use.
      Please change your app layout to not have this module.
      This is a temporary limitation that we intend to remove in the future. 
      For more details please see this GitHub issue: https://github.com/graphql-nexus/nexus/issues/139
    `)
  }

  log.trace('Writing start module to disk')
  await FS.writeAsync(layout.build.startModuleOutPath, startModule)
}
