import { Command } from '../helpers'

export class Init implements Command {
  public static new(): Init {
    return new Init()
  }

  async parse() {
    console.log('todo')
  }
}
