import { Command, flags } from '@oclif/command'
import * as fs from 'fs-jetpack'
import * as path from 'path'
import {
  compile,
  findProjectDir,
  generateArtifacts,
  getTranspiledPath,
  readTsConfig,
  findServerEntryPoint,
  pumpkinsPath,
} from '../../utils'
import { runPrismaGenerators } from '../../framework/plugins'
import { setupBootModule } from '../utils'
import { scan } from '../../framework/layout'

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

    // Create the pumpkins entrypoint. This handles
    // important system-like guarantees such as pumpkins
    // import and defusing dev mode.

    const entrypoint = flags.entrypoint
      ? fs.path(flags.entrypoint)
      : findServerEntryPoint()

    const bootPath = pumpkinsPath('boot.ts')

    setupBootModule({
      stage: 'dev',
      appEntrypointPath: entrypoint,
      path: bootPath,
    })

    // Generate typegen that will be needed for build.

    this.log('🎃  Generating Nexus artifacts ...')
    const { error } = await generateArtifacts(bootPath)
    if (error) {
      this.error(error, { exit: 1 })
    }

    // The heart of the build, the actual TypeScript compilation

    const { transpiledEntrypointPath } = this.compileProject(entrypoint)

    // Create the pumpkins entrypoint again. This time for the built app.

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

    setupBootModule({
      stage: 'build',
      appEntrypointPath: `./${renamedEntryPoint}`,
      path: transpiledEntrypointPath,
    })
  }
}
