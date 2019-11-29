import * as fs from 'fs-jetpack'
import { BUILD_FOLDER_NAME } from '../../constants'
import * as Layout from '../../framework/layout'
import { runPrismaGenerators } from '../../framework/plugins'
import { createStartModuleContent } from '../../framework/start'
import {
  compile,
  findOrScaffoldTsConfig,
  generateArtifacts,
  pog,
  readTsConfig,
  transpileModule,
} from '../../utils'
import { Command } from '../helpers'

const log = pog.sub('cli:build')

export class Build implements Command {
  public static new(): Build {
    return new Build()
  }

  async parse(argv: string[]) {
    // Handle Prisma integration
    // TODO pluggable CLI
    const layout = await Layout.create()

    await findOrScaffoldTsConfig(layout)
    await runPrismaGenerators()

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
    const tsConfig = readTsConfig(layout)
    compile(tsConfig.fileNames, tsConfig.options)

    log('transpiling start module')
    const startModule = transpileModule(
      createStartModuleContent({
        stage: 'build',
        appPath: layout.app.path,
        layout,
      }),
      tsConfig.options
    )

    log('writing start module to disk')
    await fs.writeAsync(fs.path(`${BUILD_FOLDER_NAME}/start.js`), startModule)

    log('done')
    console.log('🎃  Pumpkins server successfully compiled!')
  }
}
