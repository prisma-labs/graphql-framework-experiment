import { Command } from '../helpers'
import * as Layout from '../../framework/layout'
import doctor from '../../doctor'

export class Doctor implements Command {
  async parse() {
    const layout = await Layout.create()
    await doctor.tsconfig.check(layout)
    await doctor.vscodeTypeScriptVersion.check()
  }
}
