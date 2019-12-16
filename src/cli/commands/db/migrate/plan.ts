import { validateAndLoadDBDriver } from '../../../../utils'
import { Command } from '../../../helpers'

export class DbPlan implements Command {
  async parse() {
    const dbDriver = await validateAndLoadDBDriver()

    await dbDriver.db?.migrate.plan.onStart()
  }
}
