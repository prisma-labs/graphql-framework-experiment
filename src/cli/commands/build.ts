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
  createTSProgram,
  extractContextTypes,
} from '../../utils'
import { Command } from '../helpers'

const log = pog.sub('cli:build')

export class Build implements Command {
  async parse(argv: string[]) {
    // Handle Prisma integration
    // TODO pluggable CLI
    const layout = await Layout.create()

    await findOrScaffoldTsConfig(layout)
    await runPrismaGenerators()

    const tsProgram = createTSProgram(layout)
    const contextFieldTypes = extractContextTypes(tsProgram)
    process.env.PUMPKINS_TYPEGEN_ADD_CONTEXT_RESULTS = JSON.stringify(
      contextFieldTypes
    )

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
    // Recreate our program instance so that it picks up the typegen. We use
    // incremental builder type of program so that the cache from the previous
    // run of TypeScript should make re-building up this one cheap.
    compile(createTSProgram(layout))

    log('transpiling start module')
    const startModule = transpileModule(
      createStartModuleContent({
        stage: 'build',
        appPath: layout.app.path,
        layout,
      }),
      tsProgram.getCompilerOptions()
    )

    log('writing start module to disk')
    await fs.writeAsync(fs.path(`${BUILD_FOLDER_NAME}/start.js`), startModule)

    log('done')
    console.log('🎃  Pumpkins server successfully compiled!')
  }
}
