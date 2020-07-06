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
   * Information about this process bin
   */
  thisProcessScriptPath: string
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
  let inputScriptPath = input.scriptPath ?? process.argv[1]

  // Node CLI supports omitting the ".js" ext like this: $ node a/b/c/foo
  // Handle that case otherwise the realpathSync below will fail.
  if (Path.extname(inputScriptPath) !== '.js') {
    if (fs.existsSync(inputScriptPath + '.js')) {
      inputScriptPath += '.js'
    }
  }

  // todo try-catch? can we guarantee this? If not, what is the fallback?
  const thisProcessScriptPath = fs.realpathSync(inputScriptPath)
  let projectDir = null

  try {
    projectDir = findFileRecurisvelyUpwardSync('package.json', { cwd })?.dir
  } catch (e) {}

  if (!projectDir) {
    console.log('no project dir!!')
    console.log('no project dir!!')
    console.log('no project dir!!')
    console.log('no project dir!!')
    return {
      nodeProject: false,
      toolProject: false,
      toolCurrentlyPresentInNodeModules: false,
      runningLocalTool: false,
      thisProcessScriptPath,
      project: null,
    }
  }

  const projectNodeModulesDir = Path.join(projectDir, 'node_modules')
  const projectBinDir = Path.join(projectNodeModulesDir, '.bin')
  const projectToolBinPath = Path.join(projectBinDir, input.depName)
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
    console.log('no tool dir!!')
    console.log('no tool dir!!')
    console.log('no tool dir!!')
    console.log('no tool dir!!')
    return {
      nodeProject: true,
      toolProject: false,
      toolCurrentlyPresentInNodeModules: false,
      runningLocalTool: false,
      thisProcessScriptPath,
      project,
    }
  }

  let projectToolPath: string | null = null
  try {
    const toolPackageJsonPath = requireResolveFrom(`${input.depName}/package.json`, projectDir)
    const toolDir = Path.dirname(toolPackageJsonPath)
    const relativeProjectToolPath: string | undefined = require(toolPackageJsonPath)?.bin[input.depName]

    if (relativeProjectToolPath) {
      const absoluteProjectToolPath = Path.join(toolDir, relativeProjectToolPath)
      if (fs.existsSync(absoluteProjectToolPath) && fs.existsSync(projectToolBinPath)) {
        projectToolPath = absoluteProjectToolPath
      }
    }
  } catch (e) {}

  if (!projectToolPath) {
    console.log('no project tool path!!')
    console.log('no project tool path!!')
    console.log('no project tool path!!')
    console.log('no project tool path!!')
    return {
      nodeProject: true,
      toolProject: true,
      toolCurrentlyPresentInNodeModules: false,
      runningLocalTool: false,
      thisProcessScriptPath,
      project,
    }
  }

  Object.assign(project, {
    toolPath: projectToolPath
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

  if (thisProcessScriptPath !== project.toolPath) {
    console.log('process script path !== tool path')
    console.log('process script path !== tool path')
    console.log('process script path !== tool path')
    console.log('process script path !== tool path')
    console.log('process script path !== tool path')
    return {
      nodeProject: true,
      toolProject: true,
      toolCurrentlyPresentInNodeModules: true,
      runningLocalTool: false,
      thisProcessScriptPath: thisProcessScriptPath,
      project,
    }
  }

  return {
    nodeProject: true,
    toolProject: true,
    toolCurrentlyPresentInNodeModules: true,
    runningLocalTool: true,
    thisProcessScriptPath,
    project,
  }
}
