import Git from 'simple-git/promise'
import { scan } from '../../framework/layout'
import { findOrScaffoldTsConfig } from '../../utils'
import { Command } from '../helpers'
import chalk from 'chalk'

export class Doctor implements Command {
  public static new(): Doctor {
    return new Doctor()
  }

  async parse() {
    const frameworkDotFolder = '.pumpkins'
    const git = Git(process.cwd())

    console.log(chalk.bold('-- .gitignore --'))
    if (await git.checkIsRepo()) {
      if ((await git.checkIgnore([frameworkDotFolder])).length === 0) {
        console.log(
          chalk`{yellow Warning:}  Please add ${frameworkDotFolder} to your gitignore file`
        )
      } else {
        console.log(
          chalk`{green OK:}  ${frameworkDotFolder} is git-ignored correctly`
        )
      }
    }

    console.log(chalk.bold('-- tsconfig.json --'))
    const layout = await scan()
    const result = await findOrScaffoldTsConfig(layout, {
      exitAfterError: false,
    })
    if (result === 'success') {
      console.log(
        chalk`{green OK:} "tsconfig.json" is present and in the right directory`
      )
    }
  }
}
