import * as path from 'path'
import { runPrismaGenerators } from '../../framework/plugins'
import { findServerEntryPoint } from '../../utils'
import { watcher } from '../../watcher'
import { Command } from '../helpers'
import { createBootModuleContent } from '../utils'

export class Dev implements Command {
  public static new(): Dev {
    return new Dev()
  }

  async parse(_argv: string[]) {
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
