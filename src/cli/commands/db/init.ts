import { validateAndLoadDBDriver, fatal } from '../../../utils'
import { Command, arg, isError } from '../../helpers'
import { generateHelpForCommand } from '../../helpers/helpers'

export class DbInit implements Command {
  async parse(argv: string[]) {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
    })

    if (isError(args)) {
      fatal(args.message)
    }

    if (args['--help']) {
      return this.help()
    }

    const dbDriver = await validateAndLoadDBDriver()

    await dbDriver.db?.init.onStart()
  }

  help() {
    const help = generateHelpForCommand(
      'db init',
      'Initialize your database',
      []
    )

    console.log(help)
  }
}
