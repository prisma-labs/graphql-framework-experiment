import {
  arg,
  Command,
  generateHelpForCommand,
  isError,
} from '../../../../lib/cli'
import { validateAndLoadDBDriver } from '../../../../lib/plugin'
import { fatal } from '../../../../lib/process'

export class DbRollback implements Command {
  async parse(argv: string[]) {
    const args = arg(argv, {
      '--stage': String,
      '--help': String,
      '-h': '--help',
    })
    if (isError(args)) {
      fatal(args.message)
    }

    if (args['--help']) {
      return this.help()
    }

    const dbDriver = await validateAndLoadDBDriver()

    await dbDriver.db?.migrate.rollback.onStart()
  }

  help() {
    const help = generateHelpForCommand(
      'db rollback',
      'Rollback a migration to your database',
      [
        {
          name: 'stage',
          description: 'Set the stage to load an environment',
        },
      ]
    )

    console.log(help)
  }
}
