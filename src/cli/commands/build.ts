import * as fs from 'fs-jetpack'
import { scan } from '../../framework/layout'
import { runPrismaGenerators } from '../../framework/plugins'
import { compile, generateArtifacts, readTsConfig } from '../../utils'
import { createBootModuleContent } from '../utils'
import { Command } from '../helpers'

export class Build implements Command {
  public static new(): Build {
    return new Build()
  }

  async parse(argv: string[]) {
    // Handle Prisma integration
    // TODO pluggable CLI
    await runPrismaGenerators()

    const layout = await scan()

    console.log('🎃  Generating Nexus artifacts ...')
    await generateArtifacts(
      createBootModuleContent({
        sourceEntrypoint: layout.app.exists ? layout.app.path : undefined,
        stage: 'dev',
        app: !layout.app.exists,
      })
    )

    console.log('🎃  Compiling ...')
    const tsConfig = readTsConfig()
    compile(tsConfig.fileNames, tsConfig.options)

    await fs.writeAsync(
      fs.path('dist/__start.js'),
      createBootModuleContent({
        stage: 'build',
        sourceEntrypoint: layout.app.exists ? layout.app.path : undefined,
        app: !layout.app.exists,
      })
    )

    console.log('🎃  Pumpkins server successfully compiled!')
  }
}
