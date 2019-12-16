import { validateAndLoadDBDriver } from '../../../utils'
import { Command } from '../../helpers'

export class DbInit implements Command {
  async parse() {
    const dbDriver = await validateAndLoadDBDriver()

    await dbDriver.db?.init.onStart()
  }
}
