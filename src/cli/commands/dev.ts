import * as path from 'path'
import { runPrismaGenerators } from '../../framework/plugins'
import { watcher } from '../../watcher'
import { Command } from '../helpers'
import { createStartModuleContent } from '../../framework/start'
import { scan } from '../../framework/layout'

export class Dev implements Command {
  public static new(): Dev {
    return new Dev()
  }

  async parse(_argv: string[]) {
    // Handle Prisma integration
    // TODO pluggable CLI
    await runPrismaGenerators()

    const layout = await scan()

    watcher(
      undefined,
      [],
      [],
      {
        'tree-kill': true,
        'transpile-only': true,
        respawn: true,
        eval: {
          code: createStartModuleContent({
            stage: 'dev',
            appPath: layout.app.path,
            layout,
          }),
          fileName: 'start.js',
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
