import * as path from 'path'
import { runPrismaGenerators } from '../../framework/plugins'
import { createWatcher } from '../../watcher'
import { Command } from '../helpers'

import React, { Component, useState } from 'react'
import { render, Box, Text, useInput, Key } from 'ink'
import { scan, Layout } from '../../framework/layout'
import { createStartModuleContent } from '../../framework/start'
import { pog } from '../../utils'
import * as fs from 'fs'
import { ForkOptions } from 'child_process'
// import StyledBox from 'ink-box'

const log = pog.sub('cli:dev')

export class Dev implements Command {
  async parse(_argv: string[]) {
    // Capture all debug and console.log output
    // We could use a seperate file for stderr but this just seems to make it
    // harder to tail in combination with stdout. If we think about how the
    // experience of observing logs from an app in a tty typically works the
    // separation of stderr and stdout is not done. So lets not do it here.
    const output = fs.createWriteStream('./std_out_and_err.log')
    const logger = new console.Console(output, output, false)
    console.log = logger.log.bind(logger)
    console.warn = logger.warn.bind(logger)
    console.error = logger.error.bind(logger)
    console.debug = logger.debug.bind(logger)
    console.dir = logger.dir.bind(logger)
    require('debug').log = console.log

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

    await runPrismaGenerators()
    const layout = await scan()

    const { waitUntilExit } = render(
      <DevMode layout={layout} runnerSTDIO={['ipc', output, output]} />
    )
    await waitUntilExit()
  }
}

interface Props {
  layout: Layout
  runnerSTDIO: ForkOptions['stdio']
}

interface State {
  lastEvent: 'start' | 'restart' | 'compiled'
  fileName?: string
  lastInput?: string
  logBuffer: string
  i: number
}

const DevMode: React.FC<Props> = props => {
  const [lastInput, updateLastUpdate] = useState<null | {
    charOrPaste: string
    keys: Key
  }>(null)

  useInput((charOrPaste, keys) => {
    log('got input "%s" with modifier keys %O', charOrPaste, keys)
    updateLastUpdate({ charOrPaste, keys })
  })

  return (
    <Box
      flexDirection="column"
      height={process.stdout.rows - 0}
      width={process.stdout.columns - 0}
    >
      {/* <StyledBox borderStyle="round" borderColor="cyan" padding={1}>
        {JSON.stringify(lastInput)}
      </StyledBox> */}
      <Box>hello world</Box>
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
//           if (event === 'ready') {
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
