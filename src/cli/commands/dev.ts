import { Command } from '@oclif/command'
import * as path from 'path'
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
    const projectDir = findProjectDir()

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

    watcher(
      bootPath.absolute,
      [],
      [],
      {
        'tree-kill': true,
        'transpile-only': true,
        respawn: true,
      },
      {
        onStart() {
          console.log('🎃  Starting pumpkins server...')
        },
        onRestart(fileName: string) {
          console.log(
            `🎃  ${path.relative(projectDir, fileName)} changed. Restarting...`
          )
        },
      }
    )
  }
}
