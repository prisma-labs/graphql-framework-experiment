import * as fs from 'fs'
import * as path from 'path'
import { findFileRecurisvelyUpwardSync } from '../fs'

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
    binDir: string
    toolBinPath: string
    /**
     * Only present when the project is actually a tool project with dependencies installed.
     */
    toolBinRealPath: null | string
  }
  /**
   * Information about this process bin
   */
  thisProcessToolBin: {
    path: string
    dir: string
    realPath: string
    realDir: string
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
   * The path to the script that was run by this process. Useful option for
   * testing. Otherwise will usually rely on the default.
   *
   * @default process.argv[1]
   */
  scriptPath?: string
}

/**
 * Detect the layout of the bin used for this process, and if there is a local
 * version available.
 */
export function detectExecLayout(input: Input): ExecScenario {
  const cwd = input.cwd ?? process.cwd()
  let thisProcessScriptPath = input.scriptPath ?? process.argv[1]

  // Node CLI supports omitting the ".js" ext like this: $ node a/b/c/foo
  // Handle that case otherwise the realpathSync below will fail.
  if (path.extname(thisProcessScriptPath) !== '.js') {
    if (fs.existsSync(thisProcessScriptPath + '.js')) {
      thisProcessScriptPath += '.js'
    }
  }

  // todo try-catch? can we guarantee this? If not, what is the fallback?
  const thisProcessBinRealPath = fs.realpathSync(thisProcessScriptPath)
  const thisProcessBinDir = path.dirname(thisProcessScriptPath)
  const thisProcessBinRealDir = path.dirname(thisProcessBinRealPath)
  const thisProcessBinName = path.basename(thisProcessScriptPath)
  const thisProcessToolBin = {
    name: thisProcessBinName,
    path: thisProcessScriptPath,
    dir: thisProcessBinDir,
    realPath: thisProcessBinRealPath,
    realDir: thisProcessBinRealDir,
  }
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
      thisProcessToolBin,
      project: null,
    }
  }

  const projectNodeModulesDir = path.join(projectDir, 'node_modules')
  const projectBinDir = path.join(projectNodeModulesDir, '.bin')
  const projectToolBinPath = path.join(projectBinDir, thisProcessToolBin.name)
  const project = {
    dir: projectDir,
    binDir: projectBinDir,
    nodeModulesDir: projectNodeModulesDir,
    toolBinPath: projectToolBinPath,
    toolBinRealPath: null,
  }

  let isToolProject = null
  try {
    isToolProject =
      typeof require(path.join(projectDir, 'package.json'))?.dependencies?.[input.depName] === 'string'
  } catch (e) {
    console.log(e)
  }

  if (!isToolProject) {
    return {
      nodeProject: true,
      toolProject: false,
      toolCurrentlyPresentInNodeModules: false,
      runningLocalTool: false,
      thisProcessToolBin,
      project,
    }
  }

  let projectToolBinRealPath = null
  try {
    projectToolBinRealPath = fs.realpathSync(projectToolBinPath)
  } catch (e) {}

  if (!projectToolBinRealPath) {
    return {
      nodeProject: true,
      toolProject: true,
      toolCurrentlyPresentInNodeModules: false,
      runningLocalTool: false,
      thisProcessToolBin,
      project,
    }
  }

  Object.assign(project, {
    toolBinRealPath: projectToolBinRealPath,
  })

  /**
   * Use real path to check if local tool version is being used. This is because
   * some OS's follow symlinks in argv[1] while others do not. Since we create
   * the path to the local tool bin and we don't know (check) which OS we're
   * currently running on, we need some way to normalize both sides so that the
   * check between our constructed path and the process info from OS are
   * comparable at all. Otherwise for example we could end up in a situation
   * like this (bad):
   *
   *    node_modules/.bin/nexus === node_modules/nexus/dist/cli/main.js
   */

  if (thisProcessToolBin.realPath !== project.toolBinRealPath) {
    return {
      nodeProject: true,
      toolProject: true,
      toolCurrentlyPresentInNodeModules: true,
      runningLocalTool: false,
      thisProcessToolBin,
      project,
    }
  }

  return {
    nodeProject: true,
    toolProject: true,
    toolCurrentlyPresentInNodeModules: true,
    runningLocalTool: true,
    thisProcessToolBin,
    project,
  }
}
