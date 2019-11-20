import { Command, flags } from '@oclif/command'
import * as fs from 'fs-jetpack'
import * as path from 'path'
import {
  compile,
  findProjectDir,
  getTranspiledPath,
  readTsConfig,
  findServerEntryPoint,
  generateArtifacts2,
} from '../../utils'
import { runPrismaGenerators } from '../../framework/plugins'
import { scan } from '../../framework/layout'
import { createBootModuleContent } from '../utils'
import { app } from '../../framework'

export class Build extends Command {
  static description = 'Build a production-ready server'
  static examples = [`$ pumpkins build`]
  static flags = {
    entrypoint: flags.string({ char: 'e' }),
  }

  async run() {
    const { flags } = this.parse(Build)

    // Handle Prisma integration
    // TODO pluggable CLI
    await runPrismaGenerators()

    const layout = await scan()

    this.log('🎃  Generating Nexus artifacts ...')
    await generateArtifacts2(
      createBootModuleContent({
        sourceEntrypoint: layout.app.exists ? layout.app.path : undefined,
        stage: 'dev',
        app: !layout.app.exists,
      })
    )

    this.log('🎃  Compiling ...')
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

    this.log('🎃  Pumpkins server successfully compiled!')
  }
}
