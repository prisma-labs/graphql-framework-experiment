import { Command } from '@oclif/command'
import startTSNodeDev from 'ts-node-dev'
import { findServerEntryPoint, findConfigFile, readTsConfig } from '../utils'

export class Dev extends Command {
  static description = 'describe the command here'
  static examples = [`$ pumpkins dev`]
  static flags = {}
  static args = []

  async run() {
    // const { args, flags } = this.parse(Dev)
    const tsConfig = readTsConfig()
    const entryPoint = findServerEntryPoint(tsConfig)

    // Difficultish API to use because no docs or typings
    // Refer to these source files, top-down by caller order:
    //
    // - https://github.com/whitecolor/ts-node-dev/blob/master/bin/ts-node-dev
    // - https://github.com/whitecolor/ts-node-dev/blob/master/lib/index.js
    // - https://github.com/whitecolor/ts-node-dev/blob/master/lib/compiler.js
    //
    startTSNodeDev(entryPoint, [], [], {
      'tree-kill': true,
      'transpile-only': true,
    })
  }
}
