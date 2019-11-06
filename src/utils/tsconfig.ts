import * as ts from "typescript";
import * as path from "path";

const diagnosticHost: ts.FormatDiagnosticsHost = {
  getNewLine: () => ts.sys.newLine,
  getCurrentDirectory: () => process.cwd(),
  getCanonicalFileName: path => path
};

export function findConfigFile(
  fileName: string,
  opts: { required: true }
): string;
export function findConfigFile(
  fileName: string,
  opts: { required: false }
): string | undefined;
/**
 * Find a config file
 */
export function findConfigFile(fileName: string, opts: { required: boolean }) {
  const configPath = ts.findConfigFile(
    /*searchPath*/ process.cwd(),
    ts.sys.fileExists,
    fileName
  );

  if (!configPath) {
    if (opts.required === true) {
      throw new Error(`Could not find a valid '${fileName}'.`);
    } else {
      return undefined;
    }
  }

  return configPath;
}

function fixConfig(config: ts.ParsedCommandLine, projectDir: string) {
  // Target ES5 output by default (instead of ES3).
  if (config.options.target === undefined) {
    config.options.target = ts.ScriptTarget.ES5;
  }

  // Target CommonJS modules by default (instead of magically switching to ES6 when the target is ES6).
  if (config.options.module === undefined) {
    config.options.module = ts.ModuleKind.CommonJS;
  }

  if (config.options.outDir === undefined) {
    config.options.outDir = "dist";
  }

  config.options.rootDir = projectDir;

  return config;
}

export function readTsConfig() {
  const tsConfigPath = findConfigFile("tsconfig.json", { required: true });
  const projectDir = path.dirname(tsConfigPath);
  const tsConfigContent = ts.readConfigFile(tsConfigPath, ts.sys.readFile);

  if (tsConfigContent.error) {
    throw new Error(
      ts.formatDiagnosticsWithColorAndContext(
        [tsConfigContent.error],
        diagnosticHost
      )
    );
  }

  const inputConfig = ts.parseJsonConfigFileContent(
    tsConfigContent.config,
    ts.sys,
    projectDir,
    undefined,
    tsConfigPath
  );
  return fixConfig(inputConfig, projectDir);
}
