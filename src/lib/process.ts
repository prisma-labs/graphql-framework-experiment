import { spawn, spawnSync, SpawnSyncOptions } from 'child_process'
import { stripIndent } from 'common-tags'
import * as fs from 'fs'
import * as path from 'path'
import { format } from 'util'
import { findFileRecurisvelyUpwardSync } from './fs'
import { log } from './nexus-logger'

/**
 * Log a meaningful semantic error message sans stack track and then crash
 * the program with exit code 1. Parameters are a passthrough to `console.error`.
 */
export function fatal(template: string, ...vars: unknown[]): never {
  log.error(format(template, ...vars))
  process.exit(1)
}

export type SuccessfulRunResult = {
  command: string
  stderr: null | string // present if stdio using pipe mode
  stdout: null | string // present if stdio using pipe mode
  signal: null | string
  exitCode: null | number // present if optional (non-throw) mode
  error: null | Error // present if optonal (non-throw) mode
}

// TODO should not use sync options type for async run
export type RunOptions = Omit<SpawnSyncOptions, 'encoding'> & {
  envAdditions?: Record<string, string | undefined>
  require?: boolean
}

// TODO conditional type over require option
export function runSync(commandRaw: string, options?: RunOptions): SuccessfulRunResult {
  const command = parseCommandString(commandRaw)
  const env = options?.envAdditions ? { ...process.env, ...options.envAdditions } : process.env
  const { stderr, stdout, status: exitCode, signal } = spawnSync(command.name, command.args, {
    ...options,
    encoding: 'utf8',
    env,
  })

  const error = isFailedExitCode(exitCode)
    ? createCommandError({
        command: commandRaw,
        underlyingError: null,
        stderr,
        stdout,
        exitCode,
        signal,
      })
    : null

  if (error && options?.require === true) {
    throw error
  } else {
    return { command: commandRaw, stderr, stdout, exitCode, signal, error }
  }
}

export async function run(commandRaw: string, options?: RunOptions): Promise<SuccessfulRunResult> {
  const command = parseCommandString(commandRaw)
  const env = options?.envAdditions ? { ...process.env, ...options.envAdditions } : process.env

  const child = spawn(command.name, command.args, {
    ...options,
    env,
  })

  // TODO use proper signal typing, see child exit cb types
  const result = await new Promise<SuccessfulRunResult>((resolve, reject) => {
    // NOTE "exit" may fire after "error", in which case it will be a noop
    // as per how promises work.

    // When spawn is executed in pipe mode, then we buffer up the data for
    // later inspection
    // TODO return type should use conditional types to express mapping
    // between stdio option settings and resulting returned std err/out buffers.
    let stderr: null | string = null
    let stdout: null | string = null

    if (child.stderr) {
      stderr = ''
      child.stderr.on('data', bufferStderr)
    }

    if (child.stdout) {
      stdout = ''
      child.stdout.on('data', bufferStdout)
    }

    function bufferStderr(chunk: any) {
      stderr += String(chunk)
    }

    function bufferStdout(chunk: any) {
      stdout += String(chunk)
    }

    child.once('error', (error) => {
      const richError = createCommandError({
        command: commandRaw,
        underlyingError: error,
        stderr,
        stdout,
        signal: null,
        exitCode: null,
      })

      if (options?.require === true) {
        cleanup()
        reject(richError)
      } else {
        cleanup()
        resolve({
          command: commandRaw,
          stdout,
          stderr,
          signal: null,
          error: richError,
          exitCode: null,
        })
      }
    })

    child.once('exit', (exitCode, signal) => {
      const error = isFailedExitCode(exitCode)
        ? createCommandError({
            command: commandRaw,
            underlyingError: null,
            signal,
            stderr,
            stdout,
            exitCode,
          })
        : null

      if (options?.require === true && isFailedExitCode(exitCode)) {
        cleanup()
        reject(error)
      } else {
        cleanup()
        resolve({
          command: commandRaw,
          signal,
          stderr,
          stdout,
          exitCode,
          error,
        })
      }
    })

    function cleanup() {
      child.stderr?.removeListener('data', bufferStderr)
      child.stdout?.removeListener('data', bufferStdout)
    }
  })

  return result
}

export const createRunner = (cwd: string): typeof runSync => {
  return (cmd, opts) => {
    return runSync(cmd, { ...opts, cwd })
  }
}

function createCommandError({
  command,
  signal,
  stderr,
  stdout,
  exitCode,
  underlyingError,
}: Omit<SuccessfulRunResult, 'error'> & {
  underlyingError: null | Error
}): Error {
  const error = new Error(stripIndent`
    The following command failed to complete successfully:

        ${command}

    It ended with this exit code:

        ${exitCode}

    This underlying error occured (null = none occured):

        ${underlyingError}

    It received signal (null = no signal received):

        ${signal}

    It output on stderr (null = not spawned in pipe mode):

        ${stderr}

    It output on stdout (null = not spawned in pipe mode):

        ${stdout}
  `)
  // @ts-ignore
  error.exitCode = exitCode
  // @ts-ignore
  error.signal = signal
  // @ts-ignore
  error.stderr = stderr
  // @ts-ignore
  error.stdout = stdout
  return error
}

function parseCommandString(cmd: string): { name: string; args: string[] } {
  const [name, ...args] = cmd.split(' ')

  return {
    name,
    args,
  }
}

function isFailedExitCode(exitCode: null | number): boolean {
  return typeof exitCode === 'number' && exitCode !== 0
}

export function clearConsole() {
  /**
   * For convenience, we disable clearing the console when debugging
   */
  if (process.env.DEBUG !== undefined) {
    return
  }

  process.stdout.write('\x1Bc')
}

type ExecScenario = {
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
    name: string
    path: string
    dir: string
    realPath: string
    realDir: string
  }
}

/**
 * Detect the layout of the bin used for this process, and if there is a local
 * version available.
 */
export function detectExecLayout(tool: { depName: string }): ExecScenario {
  let thisProcessBinPath = process.argv[1]

  // Node CLI supports omitting the ".js" ext like this: $ node a/b/c/foo
  // Handle that case otherwise the realpathSync below will fail.
  if (path.extname(thisProcessBinPath) !== '.js') {
    if (fs.existsSync(thisProcessBinPath + '.js')) {
      thisProcessBinPath += '.js'
    }
  }

  // todo try-catch? can we guarantee this? If not, what is the fallback?
  const thisProcessBinRealPath = fs.realpathSync(thisProcessBinPath)
  const thisProcessBinDir = path.dirname(thisProcessBinPath)
  const thisProcessBinRealDir = path.dirname(thisProcessBinRealPath)
  const thisProcessBinName = path.basename(thisProcessBinPath)
  const thisProcessToolBin = {
    name: thisProcessBinName,
    path: thisProcessBinPath,
    dir: thisProcessBinDir,
    realPath: thisProcessBinRealPath,
    realDir: thisProcessBinRealDir,
  }
  let projectDir = null

  try {
    projectDir = findFileRecurisvelyUpwardSync('package.json', { cwd: process.cwd() })?.dir
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
    isToolProject = typeof require('./package.json')?.dependencies?.[tool.depName] === 'string'
  } catch (e) {}

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

/**
 * Handoff execution from a global to local version of a package.
 *
 * If the givne global module path is not a real node package (defined as being
 * unable to locate its package.json file) then an error will be thrown.
 *
 * An environment variable called `GLOBAL_LOCAL_HANDOFF` will be set to
 * `"true"`. Use this to short-circuit startup logic.
 */
export function globalLocalHandoff(input: { localPackageDir: string; globalPackageFilename: string }) {
  if (process.env.GLOBAL_LOCAL_HANDOFF) {
    console.warn('warning: multiple calls to `globalLocalHandoff`, this should not happen.')
  }

  process.env.GLOBAL_LOCAL_HANDOFF = 'true'

  const globalProjectDir = findFileRecurisvelyUpwardSync('package.json', {
    cwd: path.dirname(input.globalPackageFilename),
  })?.dir

  if (!globalProjectDir) {
    throw new Error(
      `Could not perform handoff to local package version becuase the given global package does not appear to actually be a package:\n\n${input.globalPackageFilename}`
    )
  }

  require(path.join(input.localPackageDir, path.relative(globalProjectDir, input.globalPackageFilename)))
}
