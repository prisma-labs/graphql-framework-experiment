import { Command } from '../helpers'

export class Init implements Command {
  async parse() {
    console.log('todo')
  }
}
