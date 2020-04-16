import { arg, Command, isError } from '../../lib/cli'
import * as Layout from '../../lib/layout'
import { rootLogger } from '../../lib/nexus-logger'
import { ownPackage } from '../../lib/own-package'
import * as Plugin from '../../lib/plugin'
import { fatal } from '../../lib/process'
import { createWatcher } from '../../lib/watcher'

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
    const plugins = await Plugin.loadWorktimePlugins(layout)

    for (const p of plugins) {
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

    await createWatcher({
      inspectBrk: args['--inspect-brk'],
      plugins: [layoutPlugin].concat(plugins.map((p) => p.hooks)),
      sourceRoot: layout.sourceRoot,
    })
  }
}
