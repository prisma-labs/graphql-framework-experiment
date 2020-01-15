import { Command } from './types'

export class Version implements Command {
  static new(): Version {
    return new Version()
  }
  private constructor() {}
  async run(argv: string[]) {
    const packageJson = require('../../../package.json')

    return `${packageJson.name}@${packageJson.version}`
  }
}
