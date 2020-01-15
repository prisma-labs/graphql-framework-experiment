import { fatal, validateAndLoadDBDriver } from '../../../utils'
import { arg, Command, isError } from '../../helpers'
import { generateHelpForCommand } from '../../helpers/helpers'

export class DbUi implements Command {
  async run(argv: string[]) {
    const args = arg(argv, {
      '--stage': String,
      '--port': Number,
      '-p': '--port',
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

    await dbDriver.db?.ui.onStart({ port: args['--port'] })
  }

  help() {
    const help = generateHelpForCommand(
      'db ui',
      'Browse your data with a database UI',
      [
        {
          name: 'stage',
          description: 'Set the stage to load an environment',
        },
        {
          name: 'port',
          alias: 'p',
          description: 'Port to start the database UI on',
        },
      ]
    )

    console.log(help)
  }
}
