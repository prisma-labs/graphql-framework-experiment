import { validateAndLoadDBDriver } from '../../../../utils'
import { Command } from '../../../helpers'

export class DbApply implements Command {
  async parse() {
    const dbDriver = await validateAndLoadDBDriver()

    await dbDriver.db?.migrate.apply.onStart()
  }
}
