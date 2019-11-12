import { Command, flags } from '@oclif/command'
import { generateArtifacts, runPrismaGenerators } from '../../utils'

export class Generate extends Command {
  static description = 'Generate the artifacts'

  static examples = [`$ pumpkins generate`]

  static flags = {
    entrypoint: flags.string({ char: 'e' }),
  }

  static args = []

  async run() {
    const { args, flags } = this.parse(Generate)
    await runPrismaGenerators()
    const { error } = await generateArtifacts(flags.entrypoint)

    if (error) {
      this.error(error, { exit: 1 })
    }

    this.log('🎃  Successfully generated the artifacts')
  }
}
