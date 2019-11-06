import { Command, flags } from '@oclif/command'

export class Init extends Command {
  static description = 'describe the command here'

  static examples = [`$ pumpkins init`]

  static flags = {}

  static args = []

  async run() {
    const { args, flags } = this.parse(Init)

    this.log('todo')
  }
}
