import { spawn, spawnSync, SpawnSyncOptions } from 'child_process'
import { stripIndent } from 'common-tags'
import * as path from 'path'
import { format } from 'util'
import { findFileRecurisvelyUpwardSync } from '../fs'
import { log } from '../nexus-logger'

/**
 * Log a meaningful semantic error message sans stack track and then crash
 * the program with exit code 1. Parameters are a passthrough to `console.error`.
 */
export function fatal(template: string, context: Record<string, unknown>): never {
  log.fatal(template, context)
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

export * from './detect-exec-layout'
