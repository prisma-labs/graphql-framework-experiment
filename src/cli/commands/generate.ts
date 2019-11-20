import { Command, flags } from '@oclif/command'
import { generateArtifacts } from '../../utils'
import { runPrismaGenerators } from '../../framework/plugins'
import { createBootModuleContent } from '../utils'
import { scan } from '../../framework/layout'

export class Generate extends Command {
  static description = 'Generate the artifacts'
  static examples = [`$ pumpkins generate`]
  static flags = {
    entrypoint: flags.string({ char: 'e' }),
  }
  static args = []

  async run() {
    // const { flags } = this.parse(Generate)

    // Handle Prisma integration
    // TODO pluggable CLI
    await runPrismaGenerators()

    const layout = await scan()

    this.log('🎃  Generating Nexus artifacts ...')
    await generateArtifacts(
      createBootModuleContent({
        sourceEntrypoint: layout.app.exists ? layout.app.path : undefined,
        stage: 'dev',
        app: !layout.app.exists,
      })
    )

    this.log('🎃  Successfully generated the artifacts')
  }
}
