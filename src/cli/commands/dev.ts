import { arg, Command, isError } from '../../lib/cli'
import * as Layout from '../../lib/layout'
import { rootLogger } from '../../lib/nexus-logger'
import { ownPackage } from '../../lib/own-package'
import * as Plugin from '../../lib/plugin'
import { fatal } from '../../lib/process'
import { findOrScaffoldTsConfig, transpileModule } from '../../lib/tsc'
import { createWatcher } from '../../lib/watcher'
import { createStartModuleContent } from '../../runtime/start'
import * as ts from 'typescript'

const log = rootLogger.child('dev')

const DEV_ARGS = {
  '--inspect-brk': String,
}

export class Dev implements Command {
  async parse(argv: string[]) {
    const args = arg(argv, DEV_ARGS)

    if (isError(args)) {
      fatal(args.message)
    }

    /**
     * Load config before loading plugins which may rely on env vars being defined
     */
    const layout = await Layout.create()
    const plugins = await Plugin.readAllPluginManifestsFromConfig(layout)
    const worktimePlugins = await Plugin.loadWorktimePlugins(layout)

    await findOrScaffoldTsConfig(layout)

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
            const layout = await Layout.create()
            return {
              environmentAdditions: Layout.saveDataForChildProcess(layout),
            }
          }
        },
      },
    }

    const startModule = createStartModuleContent({
      internalStage: 'dev',
      plugins,
      layout,
      absoluteModuleImports: true,
    })
    const transpiledStartModule = transpileModule(startModule, {
      target: ts.ScriptTarget.ES5,
      module: ts.ModuleKind.CommonJS,
    })

    await createWatcher({
      entrypointScript: transpiledStartModule,
      sourceRoot: layout.sourceRoot,
      cwd: process.cwd(),
      plugins: [layoutPlugin].concat(worktimePlugins.map((p) => p.hooks)),
      inspectBrk: args['--inspect-brk'],
    })
  }
}
