import chalk from 'chalk'
import { Box, Instance, render } from 'ink'
import React from 'react'
import * as readline from 'readline'
import * as Layout from '../../framework/layout'
import { createStartModuleContent } from '../../framework/start'
import { findOrScaffoldTsConfig, pog } from '../../utils'
import { clearConsole } from '../../utils/console'
import { createWatcher } from '../../watcher'
import { Command } from '../helpers'
import { loadPlugins } from '../helpers/utils'

const log = pog.sub('cli:dev')

export class Dev implements Command {
  async parse() {
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

    clearConsole()
    console.log(chalk`{bgBlue INFO} Starting dev server...`)

    const layout = await Layout.create()

    await findOrScaffoldTsConfig(layout)
    const plugins = await loadPlugins()

    for (const p of plugins) {
      await p.onDevStart?.()
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
      stage: 'dev',
      layout: layout,
      appPath: layout.app.path,
    })

    createWatcher({
      layout,
      transpileOnly: true,
      respawn: true,
      eval: {
        code: bootModule,
        fileName: 'start.js',
      },
      onEvent: e => {
        if (state.logMode && e.event === 'restart') {
          clearConsole()
          console.log(chalk`{bgBlue INFO} Restarting...`, e.file)
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
