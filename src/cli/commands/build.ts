import * as fs from 'fs-jetpack'
import { scan } from '../../framework/layout'
import { runPrismaGenerators } from '../../framework/plugins'
import {
  compile,
  generateArtifacts,
  readTsConfig,
  transpileModule,
} from '../../utils'
import { createStartModuleContent } from '../../framework/start'
import { Command } from '../helpers'
import { BUILD_FOLDER_NAME } from '../../constants'

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
      createStartModuleContent({
        stage: 'dev',
        appPath: layout.app.path,
        layout,
      })
    )

    console.log('🎃  Compiling ...')
    const tsConfig = readTsConfig()
    compile(tsConfig.fileNames, tsConfig.options)

    await fs.writeAsync(
      fs.path(`${BUILD_FOLDER_NAME}/start.js`),
      transpileModule(
        createStartModuleContent({
          stage: 'build',
          appPath: layout.app.path,
          layout,
        }),
        readTsConfig().options
      )
    )

    console.log('🎃  Pumpkins server successfully compiled!')
  }
}
