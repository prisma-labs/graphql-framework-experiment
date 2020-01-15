import { fatal, validateAndLoadDBDriver } from '../../../utils'
import { arg, Command, isError } from '../../helpers'
import { generateHelpForCommand } from '../../helpers/helpers'

export class DbInit implements Command {
  async parse(argv: string[]) {
    const args = arg(argv, {
      '--stage': String,
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
    const help = generateHelpForCommand('db init', 'Initialize your database', [
      {
        name: 'stage',
        description: 'Set the stage to load an environment',
      },
    ])

    console.log(help)
  }
}
