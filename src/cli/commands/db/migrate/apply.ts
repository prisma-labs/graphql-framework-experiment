import * as Config from '../../../../framework/config'
import { fatal, validateAndLoadDBDriver } from '../../../../utils'
import { arg, Command, isError } from '../../../helpers'
import { generateHelpForCommand } from '../../../helpers/helpers'

export class DbApply implements Command {
  async parse(argv: string[]) {
    const args = arg(argv, {
      '--force': Boolean,
      '-f': '--force',
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

    const config = Config.loadAndProcessConfig(args['--stage']) ?? {}
    const dbDriver = await validateAndLoadDBDriver(config)

    await dbDriver.db?.migrate.apply.onStart({
      force: args['--force'],
    })
  }

  help() {
    const help = generateHelpForCommand(
      'db apply',
      'Apply a migrate to your database',
      [
        {
          name: 'force',
          alias: 'f',
          description: 'Force the migration to be applied',
        },
        {
          name: 'stage',
          description: 'Set the stage to load an environment',
        },
      ]
    )

    console.log(help)
  }
}
