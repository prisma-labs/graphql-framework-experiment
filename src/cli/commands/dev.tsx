import chalk from 'chalk'
import { Box, Instance, render } from 'ink'
import React from 'react'
import * as readline from 'readline'
import * as Layout from '../../framework/layout'
import { runPrismaGenerators } from '../../framework/plugins'
import { createStartModuleContent } from '../../framework/start'
import { createWatcher } from '../../watcher'
import { Command } from '../helpers'
import { pog } from '../../utils'
import doctor from '../../doctor'

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

    const layout = await Layout.create()

    await doctor.tsconfig.check(layout)
    await runPrismaGenerators()

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
      callbacks: {
        onEvent: (event, data) => {
          if (event === 'restart') {
            console.log(chalk`{bgBlue INFO} Restarting...`, data)
          }
          if (state.logMode && event === 'logging' && data !== undefined) {
            process.stdout.write(data)
          }
        },
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

// class DevComponent extends Component<Props, State> {
//   constructor(props: any) {
//     super(props)

//     this.state = {
//       lastEvent: 'start',
//       logBuffer: ' ',
//       i: 0,
//     }
//   }

//   componentDidMount() {
//     const bootModule = createStartModuleContent({
//       stage: 'dev',
//       layout: this.props.layout,
//       appPath: this.props.layout.app.path,
//     })

//     createWatcher({
//       'transpile-only': true,
//       respawn: true,
//       eval: {
//         code: bootModule,
//         fileName: 'start.js',
//       },
//       stdio: this.props.runnerSTDIO,
//       callbacks: {
//         onEvent: (event, data) => {
//           console.log('event', event)
//           if (event === 'start') {
//             this.setState({ lastEvent: event })
//           }
//           if (event === 'restart') {
//             this.setState({ lastEvent: event, fileName: data })
//           }
//           if (event === 'logging') {
//             this.setState({ logBuffer: this.state.logBuffer + data })
//           }
//           if (event === SERVER_READY_SIGNAL) {
//           }
//         },
//       },
//     })

//     process.stdin.on('data', data => {
//       const input = data.toString()
//       log('got input %s', input)
//       this.setState({ lastInput: input })
//     })

//     setInterval(() => {
//       this.setState({ i: this.state.i + 1 })
//     }, 1000)
//   }

//   renderMessage = () => {
//     if (this.state.lastEvent === 'start') {
//       return '🎃  Starting pumpkins server...'
//     }
//     if (this.state.lastEvent === 'restart') {
//       const relativePath = path.relative(process.cwd(), this.state.fileName!)
//       return `🎃  ${relativePath} changed. Restarting...`
//     }
//   }

//   render() {
//     log(
//       'render -- terminal w x h = %s x %s',
//       process.stdout.rows,
//       process.stdout.columns
//     )
//     return (
//       <Box
//         flexDirection="column"
//         height={process.stdout.rows - 1}
//         width={process.stdout.columns - 1}
//       >
//         <Box flexDirection="row">
//           <Box>L = Logs</Box>
//           <Box>D = Dashboard</Box>
//         </Box>
//         <Box>{this.state.lastInput}</Box>
//         <Box>
//           <Text>{this.state.i}</Text>
//         </Box>
//         <Box>
//           <Text>{this.state.i}</Text>
//         </Box>
//         <Box>
//           <Text>{this.state.i}</Text>
//         </Box>
//         <Box>
//           <Text>{this.state.i}</Text>
//         </Box>
//         <Box>
//           <Text>{this.state.i}</Text>
//         </Box>
//       </Box>
//     )
//   }
// }
