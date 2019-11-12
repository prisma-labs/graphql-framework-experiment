import { Command } from '@oclif/command'
import startTSNodeDev from 'ts-node-dev'
import { findServerEntryPoint, runPrismaGenerators } from '../../utils'

export class Dev extends Command {
  static description = 'describe the command here'
  static examples = [`$ pumpkins dev`]
  static flags = {}
  static args = []

  async run() {
    // const { args, flags } = this.parse(Dev)

    await runPrismaGenerators({ silent: true })
    const entryPoint = findServerEntryPoint()

    // The child process that ts-node-dev spawns will inherit
    // the state of our process.env. We want to make sure that
    // during dev the user's typegen is being run.
    process.env.PUMPKINS_SHOULD_GENERATE_ARTIFACTS = 'true'

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
      notify: false,
    })
  }
}
