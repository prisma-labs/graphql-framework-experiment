import { fatal, validateAndLoadDBDriver } from '../../../../utils'
import { Command } from '../../../helpers'
import { arg, generateHelpForCommand, isError } from '../../../helpers/helpers'

export class DbRollback implements Command {
  async parse(argv: string[]) {
    const args = arg(argv, {
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
      []
    )

    console.log(help)
  }
}
