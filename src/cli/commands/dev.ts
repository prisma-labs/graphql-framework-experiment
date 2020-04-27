import { stripIndent } from 'common-tags'
import { ts } from 'ts-morph'
import { arg, Command, isError } from '../../lib/cli'
import * as Layout from '../../lib/layout'
import { rootLogger } from '../../lib/nexus-logger'
import { ownPackage } from '../../lib/own-package'
import * as Plugin from '../../lib/plugin'
import { fatal } from '../../lib/process'
import { transpileModule } from '../../lib/tsc'
import { createWatcher } from '../../lib/watcher'
import { createStartModuleContent } from '../../runtime/start'

const log = rootLogger.child('dev')

const DEV_ARGS = {
  '--inspect-brk': String,
  '--entrypoint': String,
  '-e': '--entrypoint',
  '--help': Boolean,
  '-h': '--help',
}

export class Dev implements Command {
  async parse(argv: string[]) {
    const args = arg(argv, DEV_ARGS)

    if (isError(args)) {
      fatal(args.message)
    }

    if (args['--help']) {
      return this.help()
    }

    /**
     * Load config before loading plugins which may rely on env vars being defined
     */
    const entrypointPath = args['--entrypoint']
    const layout = await Layout.create({ entrypointPath })
    const pluginEntrypoints = await Plugin.getUsedPlugins(layout)
    const worktimePlugins = await Plugin.importAndLoadWorktimePlugins(pluginEntrypoints, layout)

    for (const p of worktimePlugins) {
      await p.hooks.dev.onStart?.()
    }

    log.info('start', { version: ownPackage.version })

    const layoutPlugin: Plugin.WorktimeHooks = {
      build: {},
      create: {},
      generate: {},
      dev: {
        addToWatcherSettings: {},
        async onBeforeWatcherStartOrRestart(change) {
          if (
            change.type === 'init' ||
            change.type === 'add' ||
            change.type === 'addDir' ||
            change.type === 'unlink' ||
            change.type === 'unlinkDir'
          ) {
            log.trace('analyzing project layout')
            const layout = await Layout.create({ entrypointPath })
            return {
              environmentAdditions: Layout.saveDataForChildProcess(layout),
            }
          }
        },
      },
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

    const transpiledStartModule = transpileModule(startModule, {
      ...layout.tsConfig.content.options,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2015,
    })

    const watcher = await createWatcher({
      entrypointScript: transpiledStartModule,
      sourceRoot: layout.sourceRoot,
      cwd: process.cwd(),
      plugins: [layoutPlugin].concat(worktimePlugins.map((p) => p.hooks)),
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
          -h,       --help    Show this help message
      `
  }
}
