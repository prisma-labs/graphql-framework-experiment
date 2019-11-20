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
        stage: 'dev',
        appPath: layout.app.path,
      })
    )

    console.log('🎃  Compiling ...')
    const tsConfig = readTsConfig()
    compile(tsConfig.fileNames, tsConfig.options)

    await fs.writeAsync(
      fs.path('dist/__start.js'),
      createBootModuleContent({
        stage: 'build',
        appPath: layout.app.path,
      })
    )

    console.log('🎃  Pumpkins server successfully compiled!')
  }
}
