import { Command } from '../helpers'
import * as Checks from '../../checks'
import * as Layout from '../../framework/layout'

export class Doctor implements Command {
  async parse() {
    const layout = await Layout.create()
    await Checks.tsconfig.check(layout)
    await Checks.vscodeTypeScriptVersion.check()
  }
}
