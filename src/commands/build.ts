import { Command, flags } from "@oclif/command";

export class Build extends Command {
  static description = "describe the command here";

  static examples = [`$ pumpkins build`];

  static flags = {};

  static args = [];

  async run() {
    const { args, flags } = this.parse(Build);

    this.log("todo");
  }
}
