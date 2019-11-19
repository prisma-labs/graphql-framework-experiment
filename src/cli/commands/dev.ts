import { Command } from '@oclif/command'
const startTSNodeDev = require('ts-node-dev')
import { runPrismaGenerators } from '../../framework/plugins'
import { createBootModuleContent } from '../utils'
import {
  findServerEntryPoint,
  pumpkinsPath,
  writePumpkinsFile,
} from '../../utils'
import { stripIndents } from 'common-tags'

export class Dev extends Command {
  static description = 'describe the command here'
  static examples = [`$ pumpkins dev`]
  static flags = {}
  static args = []

  async run() {
    // const { args, flags } = this.parse(Dev)
    await runPrismaGenerators()

    // Setup a boot module
    // this takes care of certain guarantees we want like pumpkins having been
    // imported for its side-effects.
    const appEntrypointPath = await findServerEntryPoint()
    const bootPath = pumpkinsPath('boot.ts')

    await writePumpkinsFile(
      bootPath.relative,
      stripIndents`
        // HACK This file exists because ts-node-dev does not support --eval
        // flag from ts-node. Once we replace ts-node-dev with our own dev-mode this fail will go
        // away.
        //
        // Ref: https://github.com/whitecolor/ts-node-dev/issues/43

        ${createBootModuleContent({
          stage: 'dev',
          sourceEntrypoint: appEntrypointPath,
          app: false,
        })}
      `
    )

    // Difficultish API to use because no docs or typings
    // Refer to these source files, top-down by caller order:
    //
    // - https://github.com/whitecolor/ts-node-dev/blob/master/bin/ts-node-dev
    // - https://github.com/whitecolor/ts-node-dev/blob/master/lib/index.js
    // - https://github.com/whitecolor/ts-node-dev/blob/master/lib/compiler.js
    //
    startTSNodeDev(bootPath.absolute, [], [], {
      respawn: true,
      'tree-kill': true,
      'transpile-only': true,
      notify: false,
    })
  }
}
