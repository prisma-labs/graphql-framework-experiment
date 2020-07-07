import * as fs from 'fs'
import * as Path from 'path'
import { findFileRecurisvelyUpwardSync } from '../fs'
import { requireResolveFrom } from '../utils'

export type ExecScenario = {
  /**
   * Tells you if this process was executed within a Node proejct.
   */
  nodeProject: boolean
  /**
   * Tells you if this process was executed within an app project.
   */
  toolProject: boolean
  /**
   * Tells you if the local nexus bin is installed or not.
   */
  toolCurrentlyPresentInNodeModules: boolean
  /**
   * Tells you if the current process was run from the local bin version or not.
   */
  runningLocalTool: boolean
  /**
   * Information about the project if present
   */
  project: null | {
    dir: string
    nodeModulesDir: string
    toolPath: string | null
  }
  /**
   * Information about this process
   */
  process: {
    /**
     * The script being executed by this process. Symlinks are followed, if any.
     */
    toolPath: string
  }
}

interface Input {
  /**
   * The name of the package for the tool. This is used to detect if the proejct
   * (if any found) is working with this tool or not. If it is not then checks
   * for if a local version of the package is being used are skipped.
   */
  depName: string
  /**
   * The current working directory. From here a project is looked for.
   *
   * @default process.cwd()
   */
  cwd?: string
  /**
   * The path to the script that was run by this process. Usually is `__filename`
   */
  scriptPath: string
}

/**
 * Detect the layout of the bin used for this process, and if there is a local
 * version available.
 */
export function detectExecLayout(input: Input): ExecScenario {
  const cwd = input.cwd ?? process.cwd()
  let inputToolPath = input.scriptPath

  // Node CLI supports omitting the ".js" ext like this: $ node a/b/c/foo
  // Handle that case otherwise the realpathSync below will fail.
  if (Path.extname(inputToolPath) !== '.js') {
    if (fs.existsSync(inputToolPath + '.js')) {
      inputToolPath += '.js'
    }
  }

  const processToolPath = fs.realpathSync(inputToolPath)
  let projectDir = null

  try {
    projectDir = findFileRecurisvelyUpwardSync('package.json', { cwd })?.dir
  } catch (e) {}

  if (!projectDir) {
    return {
      nodeProject: false,
      toolProject: false,
      toolCurrentlyPresentInNodeModules: false,
      runningLocalTool: false,
      process: { toolPath: processToolPath },
      project: null,
    }
  }

  const projectNodeModulesDir = Path.join(projectDir, 'node_modules')
  const projectHoistedDotBinDir = Path.join(projectNodeModulesDir, '.bin')
  const projectHoistedDotBinToolPath = Path.join(projectHoistedDotBinDir, input.depName)
  const project: ExecScenario['project'] = {
    dir: projectDir,
    nodeModulesDir: projectNodeModulesDir,
    toolPath: null,
  }

  let isToolProject = null
  try {
    isToolProject =
      typeof require(Path.posix.join(projectDir, 'package.json'))?.dependencies?.[input.depName] === 'string'
  } catch (e) {
    console.log(e)
  }

  if (!isToolProject) {
    return {
      nodeProject: true,
      toolProject: false,
      toolCurrentlyPresentInNodeModules: false,
      runningLocalTool: false,
      process: { toolPath: processToolPath },
      project,
    }
  }

  let projectToolPath: string | null = null
  try {
    /**
     * Find the project tool path by reverse engineering
     * 1. find the tool package
     * 2. find its local bin path
     * 3. check that it AND the hoisted version at project dot-bin level exist
     * 4. If yes yes yes then we've found our path!
     *
     * This logic is needed for Windows support because in Windows there are no
     * symlinks we can follow for free.
     */
    const toolPackageJsonPath = requireResolveFrom(`${input.depName}/package.json`, projectDir)
    const toolPackageDir = Path.dirname(toolPackageJsonPath)
    const toolPackageRelativeBinPath: string | undefined = require(toolPackageJsonPath)?.bin[input.depName]

    if (toolPackageRelativeBinPath) {
      const absoluteToolBinPath = Path.join(toolPackageDir, toolPackageRelativeBinPath)
      if (fs.existsSync(absoluteToolBinPath) && fs.existsSync(projectHoistedDotBinToolPath)) {
        projectToolPath = Path.resolve(absoluteToolBinPath)
      }
    }
  } catch (e) {}

  if (!projectToolPath) {
    return {
      nodeProject: true,
      toolProject: true,
      toolCurrentlyPresentInNodeModules: false,
      runningLocalTool: false,
      process: { toolPath: processToolPath },
      project,
    }
  }

  Object.assign(project, {
    toolPath: projectToolPath,
  })

  if (processToolPath !== project.toolPath) {
    return {
      nodeProject: true,
      toolProject: true,
      toolCurrentlyPresentInNodeModules: true,
      runningLocalTool: false,
      process: { toolPath: processToolPath },
      project,
    }
  }

  return {
    nodeProject: true,
    toolProject: true,
    toolCurrentlyPresentInNodeModules: true,
    runningLocalTool: true,
    process: { toolPath: processToolPath },
    project,
  }
}
