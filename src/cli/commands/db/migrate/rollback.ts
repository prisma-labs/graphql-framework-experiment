import { validateAndLoadDBDriver } from '../../../../utils'
import { Command } from '../../../helpers'

export class DbRollback implements Command {
  async parse() {
    const dbDriver = await validateAndLoadDBDriver()

    await dbDriver.db?.migrate.rollback.onStart()
  }
}
