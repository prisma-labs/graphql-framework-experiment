import { Command } from '@oclif/command'
import * as path from 'path'
import { runPrismaGenerators } from '../../framework/plugins'
import { findServerEntryPoint } from '../../utils'
import { watcher } from '../../watcher'
import { createBootModuleContent } from '../utils'

export class Dev extends Command {
  static description = 'describe the command here'
  static examples = [`$ pumpkins dev`]
  static flags = {}
  static args = []

  async run() {
    // const { args, flags } = this.parse(Dev)
    await runPrismaGenerators()
    const appEntrypointPath = await findServerEntryPoint()

    watcher(
      undefined,
      [],
      [],
      {
        'tree-kill': true,
        'transpile-only': true,
        respawn: true,
        eval: {
          code: createBootModuleContent({
            stage: 'dev',
            sourceEntrypoint: appEntrypointPath,
            app: false,
          }),
          fileName: '__start.js',
        },
      },
      {
        onStart() {
          console.log('🎃  Starting pumpkins server...')
        },
        onRestart(fileName: string) {
          console.log(
            `🎃  ${path.relative(
              process.cwd(),
              fileName
            )} changed. Restarting...`
          )
        },
      }
    )
  }
}
