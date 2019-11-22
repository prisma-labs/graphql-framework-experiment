import * as path from 'path'
import { runPrismaGenerators } from '../../framework/plugins'
import { createWatcher } from '../../watcher'
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

    createWatcher({
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
      callbacks: {
        onStart() {
          console.log('🎃  Starting pumpkins server...')
        },
        onRestart(filePath: string) {
          const filePathRelative = path.relative(process.cwd(), filePath)
          console.log(`🎃  ${filePathRelative} changed. Restarting...`)
        },
      },
    })
  }
}
