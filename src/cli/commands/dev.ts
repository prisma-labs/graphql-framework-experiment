import * as Layout from '../../framework/layout'
import { createStartModuleContent } from '../../framework/start'
import { arg, Command, isError } from '../../lib/cli'
import * as Plugin from '../../lib/plugin'
import { fatal, findOrScaffoldTsConfig } from '../../utils'
import { rootLogger } from '../../utils/logger'
import { createWatcher } from '../../watcher'

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
    const plugins = await Plugin.loadAllWorkflowPluginsFromPackageJson(layout)

    await findOrScaffoldTsConfig(layout)

    for (const p of plugins) {
      await p.hooks.dev.onStart?.()
    }

    const bootModule = createStartModuleContent({
      internalStage: 'dev',
      layout: layout,
      appPath: layout.app.path,
    })

    log.info('boot', { version: require('../../../package.json').version })

    await createWatcher({
      plugins: plugins.map(p => p.hooks),
      layout,
      eval: {
        code: bootModule,
        fileName: 'start.js',
      },
    })
  }
}
