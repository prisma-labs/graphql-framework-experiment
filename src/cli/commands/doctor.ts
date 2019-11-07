import { Command } from '@oclif/command'
import Git from 'simple-git/promise'

export class Dev extends Command {
  static description = 'Check your project state for any problems'

  async run() {
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
