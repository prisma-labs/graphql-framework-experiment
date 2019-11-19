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
import { createBootModuleContent } from '../utils'

export class Build extends Command {
  static description = 'Build a production-ready server'
  static examples = [`$ pumpkins build`]
  static flags = {
    entrypoint: flags.string({ char: 'e' }),
  }

  async run() {
    // Guarantee the side-effect features like singleton global have run.
    require(path.join(process.cwd(), 'node_modules/pumpkins'))

    const { flags } = this.parse(Build)
    // TODO pluggable CLI
    await runPrismaGenerators()
    const entrypoint = flags.entrypoint
      ? fs.path(flags.entrypoint)
      : findServerEntryPoint()

    //
    // generate artifacts
    //

    this.log('🎃  Generating Nexus artifacts ...')
    await generateArtifacts2(
      createBootModuleContent({ appEntrypointPath: entrypoint, stage: 'dev' })
    )

    const { transpiledEntrypointPath } = this.compileProject(entrypoint)
    await this.swapEntryPoint(transpiledEntrypointPath)

    this.log('🎃  Pumpkins server successfully compiled!')
  }

  compileProject(entrypoint: string) {
    this.log('🎃  Compiling ...')
    const tsConfig = readTsConfig()
    const projectDir = findProjectDir()
    const transpiledEntrypointPath = getTranspiledPath(
      projectDir,
      entrypoint,
      tsConfig.options.outDir!
    )

    compile(tsConfig.fileNames, tsConfig.options)

    return { transpiledEntrypointPath }
  }

  async swapEntryPoint(transpiledEntrypointPath: string) {
    const entryPointFileNameSansExt = path.basename(
      transpiledEntrypointPath,
      '.js'
    )
    const renamedEntryPoint = `${entryPointFileNameSansExt}__original__.js`
    const entryPointContent = await fs.readAsync(transpiledEntrypointPath)

    await fs.writeAsync(
      path.join(path.dirname(transpiledEntrypointPath), renamedEntryPoint),
      entryPointContent!
    )

    await fs.writeAsync(
      transpiledEntrypointPath,
      createBootModuleContent({
        stage: 'build',
        appEntrypointPath: `./${renamedEntryPoint}`,
      })
    )
  }
}
