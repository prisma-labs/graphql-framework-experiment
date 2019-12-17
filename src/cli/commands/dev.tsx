import { Box, Instance, render } from 'ink'
import React from 'react'
import * as readline from 'readline'
import * as Config from '../../framework/config'
import * as Layout from '../../framework/layout'
import * as Plugin from '../../framework/plugin'
import { createStartModuleContent } from '../../framework/start'
import { fatal, findOrScaffoldTsConfig, pog } from '../../utils'
import { clearConsole } from '../../utils/console'
import { logger } from '../../utils/logger'
import { createWatcher } from '../../watcher'
import { arg, Command, isError } from '../helpers'

const log = pog.sub('cli:dev')

const DEV_ARGS = {
  '--inspect-brk': Number,
}

type Args = typeof DEV_ARGS

export class Dev implements Command {
  async parse(argv: string[]) {
    const args = arg(argv, DEV_ARGS)

    if (isError(args)) {
      fatal(args.message)
    }

    // Right now dev mode assumes a tty and renders according to its height and
    // width for example. This check is not strictly needed but keeps things
    // simple for now. When we remove this constraint we should also optimize
    // the dev mode to stop providing a rich resource intensive terminal ui.
    if (process.stdout.isTTY === false) {
      console.log(
        'Sorry we do not support dev mode processes without an attached text terminal (tty)'
      )
      process.exit(0)
    }

    /**
     * Load config before loading plugins which may rely on env vars being defined
     */
    const layout = await Layout.create()
    const config = Config.loadAndProcessConfig('development') ?? {}
    const plugins = await Plugin.loadAllWorkflowPluginsFromPackageJson(
      layout,
      config
    )

    await findOrScaffoldTsConfig(layout)

    for (const p of plugins) {
      await p.hooks.dev.onStart?.()
    }

    // Setup ui/log toggling system
    let state:
      | { logMode: false; inkApp: Instance }
      | { logMode: true; inkApp: null } = {
      logMode: true,
      inkApp: null,
    }

    // Allows us to listen for events from stdin
    readline.emitKeypressEvents(process.stdin)

    // Raw mode gets rid of standard keypress events and other
    // functionality Node.js adds by default
    process.stdin.setRawMode(true)

    // Start the keypress listener for the process
    process.stdin.on('keypress', async (data, key) => {
      log('got keypress %s %s', data, key)

      // "Raw" mode so we must do our own kill switch
      if (key.sequence === '\u0003') {
        process.emit('SIGTERM' as any)
      }

      if (data === 'd') {
        if (state.logMode === false) {
          log('entering log mode')
          state.inkApp.unmount()
          state = {
            logMode: true,
            inkApp: null,
          }
          // https://github.com/vadimdemedes/ink/issues/94
          await new Promise(resolve =>
            readline.cursorTo(process.stdout, 0, 0, resolve)
          )
          await new Promise(resolve =>
            readline.clearScreenDown(process.stdout, resolve)
          )
          await new Promise(resolve =>
            readline.clearLine(process.stdout, 0, resolve)
          )
        } else {
          // TODO buffering so that when user toggles back they have a chance of
          // seeing what happened while they weren't looking.
          log('entering ui mode')
          state = {
            logMode: false,
            inkApp: render(<DevMode layout={layout} />),
          }
        }
      }
    })

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
    logger.info('Starting dev server...')

    createWatcher({
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
        if (state.logMode && e.event === 'restart') {
          clearConsole()
          logger.info('Restarting...', e.file)
        }
        if (state.logMode && e.event === 'logging') {
          process.stdout.write(e.data)
        }
      },
    })
  }
}

interface Props {
  layout: Layout.Layout
}

type Mode = 'dashboard' | 'logs'

// interface State {
//   mode:
//   lastEvent: 'start' | 'restart' | 'compiled'
//   fileName?: string
//   lastInput?: string
//   logBuffer: string
//   i: number
// }

const DevMode: React.FC<Props> = props => {
  // TODO why -1????
  return (
    <Box
      flexDirection="column"
      height={process.stdout.rows - 1}
      width={process.stdout.columns}
    >
      <Box flexDirection="column" textWrap="wrap">
        <Box key="title" paddingBottom={1}>
          Pumpkins Development Dashboard (d to toggle)
        </Box>
      </Box>
      <Box flexDirection="column">
        <Box>Nexus Typegen</Box>
        <Box>Server</Box>
      </Box>
    </Box>
  )
}
