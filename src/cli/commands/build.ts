import { Command, flags } from '@oclif/command'
import * as fs from 'fs-jetpack'
import * as path from 'path'
import {
  compile,
  findProjectDir,
  generateArtifacts,
  getTranspiledPath,
  readTsConfig,
} from '../../utils'
import { runPrismaGenerators } from '../../framework/plugins'

export class Build extends Command {
  static description = 'Build a production-ready server'
  static examples = [`$ pumpkins build`]
  static flags = {
    entrypoint: flags.string({ char: 'e' }),
  }

  async run() {
    const { flags } = this.parse(Build)
    // TODO pluggable CLI
    await runPrismaGenerators()
    const { entrypoint } = await this.generateArtifacts(flags.entrypoint)
    const { transpiledEntrypointPath } = this.compileProject(entrypoint)
    await this.swapEntryPoint(transpiledEntrypointPath)

    this.log('🎃  Pumpkins server successfully compiled!')
  }

  async generateArtifacts(entry: string | undefined) {
    this.log('🎃  Generating Nexus artifacts ...')
    const { error, entrypoint } = await generateArtifacts(entry)
    if (error) {
      this.error(error, { exit: 1 })
    }

    return { entrypoint }
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

    const wrapperContent = `
process.env.PUMPKINS_SHOULD_GENERATE_ARTIFACTS = "false"

require("./${renamedEntryPoint}")
`
    await fs.writeAsync(transpiledEntrypointPath, wrapperContent)
  }
}
