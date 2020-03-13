import {
  arg,
  Command,
  generateHelpForCommand,
  isError,
} from '../../../../lib/cli'
import { validateAndLoadDBDriver } from '../../../../lib/plugin'
import { fatal } from '../../../../lib/process'

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

    const dbDriver = await validateAndLoadDBDriver()

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
