import { Command, flags } from "@oclif/command";
import * as fs from "fs";
import * as path from "path";
import { readTsConfig, compile, findConfigFile } from "../utils";

export class Build extends Command {
  static description = "Build a production-ready server";

  static examples = [`$ pumpkins build`];

  static flags = {};

  static args = [];

  async run() {
    //const { args, flags } = this.parse(Build);
    const tsConfig = readTsConfig();
    const packageJsonPath = findConfigFile("package.json", { required: true });
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath).toString());

    if (!packageJson.main) {
      throw new Error(
        "The main property is required and needs to point to the entrypoint of your server"
      );
    }

    compile(tsConfig.fileNames, tsConfig.options);

    const entryPointPath = path.resolve(
      path.dirname(packageJsonPath),
      packageJson.main
    );
    const entryPointContent = fs.readFileSync(entryPointPath).toString();
    const wrapperContent = `
process.env.PUMPKINS_SHOULD_GENERATE_ARTIFACTS = "false"

require("./__index.js")
    `;

    fs.writeFileSync(
      path.join(path.dirname(entryPointPath), "__index.js"),
      entryPointContent
    );
    fs.writeFileSync(entryPointPath, wrapperContent);
  }
}
