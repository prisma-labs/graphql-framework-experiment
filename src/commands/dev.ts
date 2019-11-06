import { Command, flags } from "@oclif/command";

export class Dev extends Command {
  static description = "describe the command here";

  static examples = [`$ pumpkins dev`];

  static flags = {};

  static args = [];

  async run() {
    const { args, flags } = this.parse(Dev);

    this.log("todo");
  }
}
