import { arg, Command, isError } from '../../lib/cli'
import * as Layout from '../../lib/layout'
import { rootLogger } from '../../lib/nexus-logger'
import { ownPackage } from '../../lib/own-package'
import * as Plugin from '../../lib/plugin'
import { fatal } from '../../lib/process'
import { findOrScaffoldTsConfig } from '../../lib/tsc'
import { createWatcher } from '../../lib/watcher'

const log = rootLogger.child('dev')

const DEV_ARGS = {
  '--inspect-brk': Number,
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
    const plugins = await Plugin.loadInstalledWorktimePlugins(layout)

    await findOrScaffoldTsConfig(layout)

    for (const p of plugins) {
      await p.hooks.dev.onStart?.()
    }

    log.info('start', { version: ownPackage.version })

    await createWatcher({
      plugins: [],
      layout: layout,
    })
  }
}
