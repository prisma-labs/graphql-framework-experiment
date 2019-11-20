import Git from 'simple-git/promise'
import { Command } from '../helpers'

export class Doctor implements Command {
  public static new(): Doctor {
    return new Doctor()
  }

  async parse() {
    const frameworkDotFolder = '.pumpkins'
    const git = Git(process.cwd())

    if (await git.checkIsRepo()) {
      if ((await git.checkIgnore([frameworkDotFolder])).length === 0) {
        console.log(`please add ${frameworkDotFolder} to your gitignore file`)
      } else {
        console.log(`ok ${frameworkDotFolder} is git-ignored correctly`)
      }
    }
  }
}
