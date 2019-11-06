import { Command, flags } from '@oclif/command'
import { findServerEntryPoint } from '../utils'
import { spawnSync } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'

export class Generate extends Command {
  static description = 'Generate the artifacts'

  static examples = [`$ pumpkins generate`]

  static flags = {
    entrypoint: flags.string({ char: 'e' }),
  }

  static args = []

  async run() {
    const { args, flags } = this.parse(Generate)
    const entryPoint = flags.entrypoint
      ? path.join(process.cwd(), flags.entrypoint)
      : findServerEntryPoint()

    if (!fs.existsSync(entryPoint)) {
      this.error(
        `🎃  Entry point "${path.relative(
          process.cwd(),
          entryPoint
        )}" does not exist`,
        { exit: 1 }
      )
    }

    spawnSync('ts-node', [entryPoint], {
      env: {
        ...process.env,
        PUMPKINS_SHOULD_EXIT_AFTER_GENERATE_ARTIFACTS: 'true',
      },
    })

    this.log('🎃  Successfully generated the artifacts')
  }
}
