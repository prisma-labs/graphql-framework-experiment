import chalk from 'chalk'
import { Box, Instance, render, Text } from 'ink'
import React from 'react'
import * as readline from 'readline'
import * as Layout from '../../framework/layout'
import { runPrismaGenerators } from '../../framework/plugins'
import { createStartModuleContent } from '../../framework/start'
import { findOrScaffoldTsConfig, pog } from '../../utils'
import { clearConsole } from '../../utils/console'
import { createWatcher } from '../../watcher'
import { autoFixUnknownFieldType } from '../auto-fixes/unknown-field-type'
import { Command } from '../helpers'

const log = pog.sub('cli:dev')

interface AutoFixes {
  'unknown-field-type': {
    [typeName: string]: string[]
  }
}

function createEmptyAutoFixes(): AutoFixes {
  return {
    'unknown-field-type': {},
  }
}

type AppState = 'starting' | 'restarting' | 'running'
type Modes =
  | { logMode: false; inkApp: Instance }
  | { logMode: true; inkApp: null }
type State = {
  appState: AppState
  autoFixes: AutoFixes
  lastLoggingBuffer: string
}

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
    let lastLoggingBuffer = ''

    await findOrScaffoldTsConfig(layout)
    await runPrismaGenerators()

    // Setup ui/log toggling system
    let mode: Modes = {
      logMode: true,
      inkApp: null,
    }

    let state: State = {
      appState: 'starting',
      autoFixes: createEmptyAutoFixes(),
      lastLoggingBuffer: '',
    }

    function setState(partialState: Partial<State>) {
      state = { ...state, ...partialState }

      if (mode.inkApp) {
        mode.inkApp.rerender(
          <DevMode
            appState={state.appState}
            layout={layout}
            autoFixes={state.autoFixes}
          />
        )
      }
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

      if (!mode.logMode && data === 'a') {
        Object.keys(
          state.autoFixes['unknown-field-type']
        ).forEach(unknownFieldType =>
          autoFixUnknownFieldType(layout, unknownFieldType)
        )
        setState({
          autoFixes: createEmptyAutoFixes(),
        })
      }

      if (data === 'd') {
        if (mode.logMode === false) {
          log('entering log mode')
          mode.inkApp.unmount()
          mode = {
            ...mode,
            logMode: true,
            inkApp: null,
          }
          clearConsole()
          process.stdout.write(lastLoggingBuffer)
        } else {
          // TODO buffering so that when user toggles back they have a chance of
          // seeing what happened while they weren't looking.
          log('entering ui mode')
          mode = {
            ...mode,
            logMode: false,
            inkApp: render(
              <DevMode
                appState={state.appState}
                layout={layout}
                autoFixes={state.autoFixes}
              />
            ),
          }
        }
      }
    })

    // TODO
    // await runPrismaGenerators()

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
        if (e.event === 'unknown-field-type') {
          if (!state.autoFixes[e.event]) {
            state.autoFixes[e.event] = {}
          }
          if (!state.autoFixes[e.event][e.data.unknownFieldType]) {
            state.autoFixes[e.event][e.data.unknownFieldType] = []
          }

          state.autoFixes[e.event][e.data.unknownFieldType].push(
            e.data.typeName
          )

          setState(state)
        }

        if (mode.logMode && e.event === 'restart') {
          setState({
            appState: 'restarting',
            lastLoggingBuffer: '',
            autoFixes: createEmptyAutoFixes(),
          })
          clearConsole()
          console.log(chalk`{bgBlue INFO} Restarting...`, e.file)
        }
        if (!mode.logMode && e.event === 'logging') {
          lastLoggingBuffer += e.data
        }
        if (mode.logMode && e.event === 'logging') {
          process.stdout.write(e.data)
        }
        if (e.event === 'ready') {
          setState({
            appState: 'running',
          })
        }
      },
    })
  }
}

interface Props {
  layout: Layout.Layout
  autoFixes: AutoFixes
  appState: AppState
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

function renderAppState(appState: AppState) {
  switch (appState) {
    case 'starting':
      return 'Starting...'
    case 'restarting':
      return 'Restarting...'
    case 'running':
      return 'Running...'
    default:
      return ''
  }
}

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
        <Box>Server: {renderAppState(props.appState)}</Box>
        <Box>Nexus Typegen</Box>
      </Box>
      <Box flexDirection="column">
        <Box marginBottom={1} marginTop={1}>
          ISSUES
        </Box>
        <IssueUnknownFieldType autoFixes={props.autoFixes} />
      </Box>
    </Box>
  )
}

function renderIssueUnknownFieldTypeMessage() {
  return `\
Possible reasons for this:
    * Typo in your GraphQL objectType name
    * Unintentional use of t.model.*
[1] * Need to create the object type definition in your GraphQL schema
  `
}

const IssueUnknownFieldType: React.FC<{ autoFixes: AutoFixes }> = props => (
  <Box flexDirection="column">
    {Object.keys(props.autoFixes['unknown-field-type']).map(
      (unknownTypeName, i) => (
        <Box key={i}>
          Your GraphQL objectType definition(s){' '}
          {props.autoFixes['unknown-field-type'][unknownTypeName]
            .map(typeName => `"${chalk.red(typeName)}"`)
            .join(', ')}{' '}
          are referencing a type named "{unknownTypeName}" but it isn't defined
          in your GraphQL Schema.
        </Box>
      )
    )}
    <Box marginTop={1}>
      <Text>{renderIssueUnknownFieldTypeMessage()}</Text>
    </Box>
  </Box>
)
