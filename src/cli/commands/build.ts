import * as fs from 'fs-jetpack'
import { BUILD_FOLDER_NAME, START_MODULE_NAME } from '../../constants'
import * as Layout from '../../framework/layout'
import { runPrismaGenerators } from '../../framework/plugins'
import { createStartModuleContent } from '../../framework/start'
import {
  compile,
  generateArtifacts,
  pog,
  transpileModule,
  createTSProgram,
  extractContextTypes,
  fatal,
} from '../../utils'
import { Command } from '../helpers'
import ts = require('typescript')
import { stripIndent } from 'common-tags'
import doctor from '../../doctor'

const log = pog.sub('cli:build')

export class Build implements Command {
  async parse(argv: string[]) {
    // Handle Prisma integration
    // TODO pluggable CLI
    const layout = await Layout.create()

    await doctor.tsconfig.check(layout)
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

    log('compiling app...')
    console.log('🎃  Compiling ...')
    // Recreate our program instance so that it picks up the typegen. We use
    // incremental builder type of program so that the cache from the previous
    // run of TypeScript should make re-building up this one cheap.
    const tsProgramWithTypegen = createTSProgram(layout)
    compile(tsProgramWithTypegen)

    await writeStartModule(layout, tsProgram)

    console.log('🎃  Pumpkins app successfully compiled! %s', BUILD_FOLDER_NAME)
  }
}

/**
 * Output to disk in the build the start module that will be used to boot the
 * pumpkins app.
 */
async function writeStartModule(
  layout: Layout.Layout,
  tsProgram: ts.EmitAndSemanticDiagnosticsBuilderProgram
): Promise<void> {
  // TODO we can be more flexible and allow the user to write an index.ts
  // module. For example we can alias it, or, we can rename it e.g.
  // `index_original.js`. For now we just error out and ask the user to not name
  // their module index.ts.
  if (fs.exists(`${BUILD_FOLDER_NAME}/${START_MODULE_NAME}.js`)) {
    fatal(stripIndent`
      Pumpkins reserves the source root module name ${START_MODULE_NAME}.js for its own use.
      Please change your app layout to not have this module.
      This is a temporary limitation that we intend to remove in the future. 
      For more details please see this GitHub issue: https://github.com/prisma/pumpkins/issues/139
    `)
  }

  log('transpiling start module...')
  const startModule = transpileModule(
    createStartModuleContent({
      stage: 'build',
      appPath: layout.app.path,
      layout,
    }),
    tsProgram.getCompilerOptions()
  )
  log('done')

  log('writing start module to disk...')
  await fs.writeAsync(
    fs.path(`${BUILD_FOLDER_NAME}/${START_MODULE_NAME}.js`),
    startModule
  )
  log('done')
}
