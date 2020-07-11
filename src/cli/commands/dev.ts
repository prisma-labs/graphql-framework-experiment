import { stripIndent } from 'common-tags'
import { ts } from 'ts-morph'
import { arg, Command, isError } from '../../lib/cli'
import * as Layout from '../../lib/layout'
import { rootLogger } from '../../lib/nexus-logger'
import { ownPackage } from '../../lib/own-package'
import * as Plugin from '../../lib/plugin'
import { fatal } from '../../lib/process'
import * as Reflection from '../../lib/reflection'
import { transpileModule } from '../../lib/tsc'
import { rightOrFatal, simpleDebounce } from '../../lib/utils'
import { createWatcher } from '../../lib/watcher'
import { createStartModuleContent } from '../../runtime/start'

const log = rootLogger.child('dev')

const DEV_ARGS = {
  '--inspect-brk': String,
  '--entrypoint': String,
  '-e': '--entrypoint',
  '--reflection': Boolean,
  '-r': '--reflection',
  '--help': Boolean,
  '-h': '--help',
}

const debouncedReflection = simpleDebounce((layout: Layout.Layout) => {
  return Reflection.reflect(layout, { artifacts: true })
})

export class Dev implements Command {
  async parse(argv: string[]) {
    const args = arg(argv, DEV_ARGS)

    if (isError(args)) {
      fatal(args.message)
    }

    if (args['--help']) {
      return this.help()
    }

    const entrypointPath = args['--entrypoint']
    const reflectionMode = args['--reflection'] === true
    let layout = rightOrFatal(await Layout.create({ entrypointPath }))
    const pluginReflectionResult = await Reflection.reflect(layout, { usedPlugins: true, onMainThread: true })

    // TODO: Do not fatal if reflection failed.
    // Instead, run the watcher and help the user recover
    if (!pluginReflectionResult.success) {
      fatal('reflection failed', { error: pluginReflectionResult.error })
    }

    const worktimePlugins = Plugin.importAndLoadWorktimePlugins(pluginReflectionResult.plugins, layout)

    for (const p of worktimePlugins) {
      await p.hooks.dev.onStart?.()
    }

    const runDebouncedReflection = async (layout: Layout.Layout) => {
      const reflectionResult = await debouncedReflection(layout)

      if (reflectionResult.type === 'executing') {
        return
      }

      // if --reflection, log successes and all kind of errors
      if (args['--reflection']) {
        if (reflectionResult.data.success) {
          log.info('reflection done')
          log.info('waiting for file changes to run reflection...')
        } else {
          log.error('reflection failed', { error: reflectionResult.data.error })
        }
      } else {
        // if --reflection is not passed, log only errors of type "ts-error"
        // These are the whitelisted diagnostic codes from the createTSProgram function
        // We don't want to log runtime errors as the main thread will already log them
        if (!reflectionResult.data.success && reflectionResult.data.type === 'ts-error') {
          log.error('reflection failed', { error: reflectionResult.data.error })
        }
      }
    }

    log.info('start', { version: ownPackage.version })

    const devPlugin: Plugin.WorktimeHooks = {
      build: {},
      create: {},
      generate: {},
      dev: {
        addToWatcherSettings: {},
        async onBeforeWatcherStartOrRestart(change) {
          if (change.type === 'change') {
            const nexusModules = Layout.findNexusModules(
              layout.tsConfig,
              layout.app.exists ? layout.app.path : null
            )
            layout.update({ nexusModules })
          }

          if (
            change.type === 'init' ||
            change.type === 'add' ||
            change.type === 'addDir' ||
            change.type === 'unlink' ||
            change.type === 'unlinkDir'
          ) {
            log.trace('analyzing project layout')
            layout = rightOrFatal(await Layout.create({ entrypointPath }))
          }

          if (args['--reflection']) {
            log.info('running reflection')
          }

          runDebouncedReflection(layout)

          return {
            entrypointScript: getTranspiledStartModule(layout, reflectionMode),
          }
        },
      },
    }

    const watcher = await createWatcher({
      entrypointScript: getTranspiledStartModule(layout, reflectionMode),
      sourceRoot: layout.sourceRoot,
      cwd: process.cwd(),
      plugins: [devPlugin].concat(worktimePlugins.map((p) => p.hooks)),
      inspectBrk: args['--inspect-brk'],
    })

    await watcher.start()
  }

  help() {
    return stripIndent`
        Usage: nexus dev [flags]
  
        Develop your application in watch mode
  
        Flags:
          -e, --entrypoint    Custom entrypoint to your app (default: app.ts)
          -r, --reflection    Run dev mode for reflection only (eg: typegen, sdl file etc..)
          -h,       --help    Show this help message
      `
  }
}

function getTranspiledStartModule(layout: Layout.Layout, reflectionMode: boolean) {
  /**
   * We use an empty script when in reflection mode so that the user's app doesn't run.
   * The watcher will keep running though and so will reflection in the devPlugin.onBeforeWatcherStartOrRestart hook above
   */
  if (reflectionMode === true) {
    return ''
  }

  const startModule = createStartModuleContent({
    registerTypeScript: {
      ...layout.tsConfig.content.options,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2015,
    },
    internalStage: 'dev',
    runtimePluginManifests: [], // tree-shaking not needed
    layout,
    absoluteModuleImports: true,
  })

  return transpileModule(startModule, {
    ...layout.tsConfig.content.options,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2015,
  })
}
