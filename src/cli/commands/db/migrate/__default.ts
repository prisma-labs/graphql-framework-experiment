import { Command, generateHelpForCommandIndex } from '../../../../lib/cli'

export class DbDefault implements Command {
  async parse(argv: string[]) {
    // TODO: ! Unknown command "--help" when running nexus db migrate --help
    return this.help()
  }

  help() {
    const help = generateHelpForCommandIndex('db migrate', [
      { name: 'plan', description: 'Generate a migration file' },
      {
        name: 'apply',
        description: 'Apply a migration to your database',
      },
      {
        name: 'rollback',
        description: 'Rollback a migration to your database',
      },
    ])

    console.log(help)
  }
}
