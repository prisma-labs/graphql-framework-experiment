import { spawnSync, SpawnSyncOptions } from 'child_process'
import { logger } from './logger'

/**
 * Log a meaningful semantic error message sans stack track and then crash
 * the program with exit code 1. Parameters are a passthrough to `console.error`.
 */
export function fatal(format: string, ...vars: unknown[]): never {
  logger.error(format, ...vars)
  process.exit(1)
}

export type RunResult = {
  stderr: string
  stdout: string
  status: null | number
}

export type RunOptions = Omit<SpawnSyncOptions, 'encoding'> & {
  envAdditions?: Record<string, string>
  require?: boolean
}

// TODO conditional type over require option
export const run = (command: string, options?: RunOptions): RunResult => {
  const [name, ...args] = command.split(' ')
  const env = options?.envAdditions
    ? { ...process.env, ...options.envAdditions }
    : process.env
  const { stderr, stdout, status } = spawnSync(name, args, {
    ...options,
    encoding: 'utf8',
    env,
  })

  if (options?.require !== false && status !== 0) {
    throw new Error(`
      The following command failed to complete successfully:

          ${command}

      It exited with this status code:

        ${status}

      It output on stderr:

          ${stderr}

      It output on stdout:

          ${stdout}
    `)
  }

  return { stderr, stdout, status }
}

export const createRunner = (cwd: string): typeof run => {
  return (cmd, opts) => {
    return run(cmd, { ...opts, cwd })
  }
}
