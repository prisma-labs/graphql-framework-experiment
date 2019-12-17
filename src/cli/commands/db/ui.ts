import * as Config from '../../../framework/config'
import { validateAndLoadDBDriver, fatal } from '../../../utils'
import { Command, arg, isError } from '../../helpers'
import { generateHelpForCommand } from '../../helpers/helpers'

export class DbUi implements Command {
  async parse(argv: string[]) {
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

    const config = Config.loadAndProcessConfig(args['--stage']) ?? {}
    const dbDriver = await validateAndLoadDBDriver(config)

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
