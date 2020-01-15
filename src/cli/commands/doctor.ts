import chalk from 'chalk'
import * as Layout from '../../framework/layout'
import { findOrScaffoldTsConfig } from '../../utils'
import { Command } from '../helpers'

export class Doctor implements Command {
  async run() {
    await tsconfig()
  }
}

/**
 * Check that a tsconfig file is present and scaffold one if it is not.
 */
async function tsconfig() {
  console.log(chalk.bold('-- tsconfig.json --'))
  const layout = await Layout.create()
  const result = await findOrScaffoldTsConfig(layout, {
    exitAfterError: false,
  })
  if (result === 'success') {
    console.log(
      chalk`{green OK:} "tsconfig.json" is present and in the right directory`
    )
  }
}
