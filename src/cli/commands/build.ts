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

    // Create the pumpkins entrypoint. This handles
    // important system-like guarantees such as pumpkins
    // import and defusing dev mode.

    //
    // generate artifacts
    //

    this.log('🎃  Generating Nexus artifacts ...')
    await generateArtifacts2(
      createBootModuleContent({
        sourceEntrypoint: layout.app.exists ? layout.app.path : undefined,
        stage: 'dev',
        app: !layout.app.exists,
      })
    )

    // TODO
    const entrypoint = layout.app.exists
      ? layout.app.path
      : fs.path('schema.ts')

    this.log('🎃  Compiling ...')
    const tsConfig = readTsConfig()
    compile(tsConfig.fileNames, tsConfig.options)

    // wrap app module
    let sourceEntrypoint: string | undefined = undefined
    if (layout.app.exists) {
      const projectDir = findProjectDir()
      const transpiledEntrypointPath = getTranspiledPath(
        projectDir,
        entrypoint,
        tsConfig.options.outDir!
      )

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
      sourceEntrypoint = `./${renamedEntryPoint}`
    }

    await fs.writeAsync(
      fs.path('dist/app.js'),
      createBootModuleContent({
        stage: 'build',
        sourceEntrypoint,
        app: !layout.app.exists,
      })
    )

    this.log('🎃  Pumpkins server successfully compiled!')
  }
}
