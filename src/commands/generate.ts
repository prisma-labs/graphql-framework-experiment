import { Command, flags } from '@oclif/command'
import { findServerEntryPoint } from '../utils'
import { spawnSync } from 'child_process'

export class Generate extends Command {
  static description = 'Generate the artifacts'

  static examples = [`$ pumpkins generate`]

  static flags = {}

  static args = []

  async run() {
    const { args, flags } = this.parse(Generate)
    const entryPoint = findServerEntryPoint()

    spawnSync('ts-node', [entryPoint], {
      env: {
        ...process.env,
        PUMPKINS_SHOULD_EXIT_AFTER_GENERATE_ARTIFACTS: 'true',
      },
    })

    this.log('🎃  Successfully generated the artifacts')
  }
}
