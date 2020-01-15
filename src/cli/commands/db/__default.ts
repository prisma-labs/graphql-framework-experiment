import { Command } from '../../helpers'
import { generateHelpForCommandIndex } from '../../helpers/helpers'

export class DbDefault implements Command {
  async parse() {
    return this.help()
  }

  help() {
    const help = generateHelpForCommandIndex('db', [
      { name: 'init', description: 'Initialize your database' },
      {
        name: 'migrate',
        description: 'Set of commands to migrate your database',
      },
      {
        name: 'ui',
        description: 'Browse your data with a database UI',
      },
    ])

    console.log(help)
  }
}
