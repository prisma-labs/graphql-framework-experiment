import { Command, flags } from "@oclif/command";

export class Generate extends Command {
  static description = "describe the command here";

  static examples = [`$ pumpkins generate`];

  static flags = {};

  static args = [];

  async run() {
    const { args, flags } = this.parse(Generate);

    this.log("todo");
  }
}
