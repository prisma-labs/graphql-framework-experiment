import * as path from 'path'
import { runPrismaGenerators } from '../../framework/plugins'
import { watcher } from '../../watcher'
import { Command } from '../helpers'

import React, { Component } from 'react'
import { render, Box, Text, StdoutContext } from 'ink'
import { scan, Layout } from '../../framework/layout'
import { createStartModuleContent } from '../../framework/start'

interface Props {
  layout: Layout
}

interface State {
  lastEvent: 'start' | 'restart' | 'compiled'
  fileName?: string
  logBuffer: string
}

class DevComponent extends Component<Props, State> {
  constructor(props: any) {
    super(props)

    this.state = {
      lastEvent: 'start',
      logBuffer: ' ',
    }

    this.renderMessage = this.renderMessage.bind(this)
  }

  componentDidMount() {
    const bootModule = createStartModuleContent({
      stage: 'dev',
      layout: this.props.layout,
      appPath: this.props.layout.app.path,
    })

    watcher(
      undefined,
      [],
      [],
      {
        'tree-kill': true,
        'transpile-only': true,
        respawn: true,
        eval: {
          code: bootModule,
          fileName: '__start.js',
        },
      },
      {
        onEvent: (event, data) => {
          if (event === 'start') {
            this.setState({ lastEvent: event })
          }
          if (event === 'restart') {
            this.setState({ lastEvent: event, fileName: data })
          }
          if (event === 'logging') {
            this.setState({ logBuffer: this.state.logBuffer + data })
          }
          if (event === 'ready') {
          }
        },
      }
    )
  }

  renderMessage() {
    if (this.state.lastEvent === 'start') {
      return '🎃  Starting pumpkins server...'
    }
    if (this.state.lastEvent === 'restart') {
      return `🎃  ${path.relative(
        process.cwd(),
        this.state.fileName!
      )} changed. Restarting...`
    }
  }

  render() {
    return (
      <Box>
        <Text>Status: {this.renderMessage()}</Text>
        <Text>{this.state.logBuffer}</Text>
      </Box>
    )
  }
}

export class Dev implements Command {
  public static new(): Dev {
    return new Dev()
  }

  async parse(_argv: string[]) {
    await runPrismaGenerators()
    const layout = await scan()

    // watcher(
    //   undefined,
    //   [],
    //   [],
    //   {
    //     'tree-kill': true,
    //     'transpile-only': true,
    //     respawn: true,
    //     eval: {
    //       code: createBootModuleContent({
    //         stage: 'dev',
    //         app: true,
    //       }),
    //       fileName: '__start.js',
    //     },
    //   },
    //   {
    //     onEvent: (event, data) => {
    //       console.log(event, data)
    //     },
    //   }
    // )

    const { waitUntilExit } = render(<DevComponent layout={layout} />)

    await waitUntilExit()
  }
}
