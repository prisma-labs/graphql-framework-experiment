import * as fs from 'fs-jetpack'
import { scan } from '../../framework/layout'
import { runPrismaGenerators } from '../../framework/plugins'
import {
  compile,
  generateArtifacts,
  readTsConfig,
  transpileModule,
  pog,
} from '../../utils'
import { createStartModuleContent } from '../../framework/start'
import { Command } from '../helpers'
import { BUILD_FOLDER_NAME } from '../../constants'

const log = pog.sub('cli:build')

export class Build implements Command {
  public static new(): Build {
    return new Build()
  }

  async parse(argv: string[]) {
    // Handle Prisma integration
    // TODO pluggable CLI
    await runPrismaGenerators()

    const layout = await scan()

    log('running typegen')
    console.log('🎃  Generating Nexus artifacts ...')
    await generateArtifacts(
      createStartModuleContent({
        stage: 'dev',
        appPath: layout.app.path,
        layout,
      })
    )

    log('compiling app')
    console.log('🎃  Compiling ...')
    await fs.removeAsync(BUILD_FOLDER_NAME)
    const tsConfig = readTsConfig()
    compile(tsConfig.fileNames, tsConfig.options)

    log('transpiling start module')
    const startModule = transpileModule(
      createStartModuleContent({
        stage: 'build',
        appPath: layout.app.path,
        layout,
      }),
      readTsConfig().options
    )

    log('writing start module to disk')
    await fs.writeAsync(fs.path(`${BUILD_FOLDER_NAME}/start.js`), startModule)

    log('done')
    console.log('🎃  Pumpkins server successfully compiled!')
  }
}
