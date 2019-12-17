import * as Config from '../../../../framework/config'
import { fatal, validateAndLoadDBDriver } from '../../../../utils'
import { arg, Command, isError } from '../../../helpers'
import { generateHelpForCommand } from '../../../helpers/helpers'

export class DbPlan implements Command {
  async parse(argv: string[]) {
    const args = arg(argv, {
      '--name': String,
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

    const config = Config.loadAndProcessConfig(args['--stage']) ?? {}
    const dbDriver = await validateAndLoadDBDriver(config)

    await dbDriver.db?.migrate.plan.onStart({
      migrationName: args['--name'],
    })
  }

  help() {
    const help = generateHelpForCommand(
      'db plan',
      'Generate a migration file',
      [
        { name: 'name', description: 'Name of the migration' },
        {
          name: 'stage',
          description: 'Set the stage to load an environment',
        },
      ]
    )

    console.log(help)
  }
}
