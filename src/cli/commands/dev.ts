import * as Arg from 'arg'
import { arg, Command, isError } from '../../lib/cli'
import * as Layout from '../../lib/layout'
import { rootLogger } from '../../lib/nexus-logger'
import * as Plugin from '../../lib/plugin'
import { fatal } from '../../lib/process'
import { findOrScaffoldTsConfig } from '../../lib/tsc'
import { createWatcher } from '../../lib/watcher'
import { createStartModuleContent } from '../../runtime/start'

const log = rootLogger.child('dev')

const DEV_ARGS = {
  '--inspect-brk': Number,
  '--emit': Boolean,
  '--output': String,
  '-o': '--output',
}

export class Dev implements Command {
  async parse(argv: string[]) {
    const args = arg(argv, DEV_ARGS)

    if (isError(args)) {
      fatal(args.message)
    }

    log.info('boot', { version: require('../../../package.json').version })

    const buildOutput = args['--output']
      ? args['--output']
      : args['--emit']
      ? Layout.DEFAULT_BUILD_FOLDER_NAME
      : undefined
    const layout = await Layout.create({ buildOutput: buildOutput })
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

    await createWatcher({
      plugins: plugins.map(p => p.hooks),
      layout,
      eval: {
        code: bootModule,
        fileName: 'start.js',
      },
      buildOutput,
    })
  }
}
