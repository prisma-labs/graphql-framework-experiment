import * as Plugin from '../../core/plugin'
import * as Layout from '../../framework/layout'
import { createStartModuleContent } from '../../framework/start'
import { arg, Command, isError } from '../../lib/cli'
import { fatal, findOrScaffoldTsConfig } from '../../utils'
import { clearConsole } from '../../utils/console'
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

    const nodeArgs = []

    if (args['--inspect-brk']) {
      nodeArgs.push(`--inspect-brk=${args['--inspect-brk']}`)
    }

    clearConsole()
    log.info('boot')

    await createWatcher({
      plugins: plugins.map(p => p.hooks),
      layout,
      transpileOnly: true,
      respawn: args['--inspect-brk'] ? false : true,
      eval: {
        code: bootModule,
        fileName: 'start.js',
      },
      nodeArgs,
      onEvent: e => {
        if (e.event === 'restart') {
          clearConsole()
          log.info('restarting', { changed: e.file })
        }
        if (e.event === 'logging') {
          process.stdout.write(e.data)
        }
      },
    })
  }
}
