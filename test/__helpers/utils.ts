import { SimpleGit } from 'simple-git/promise'
import stripAnsi from 'strip-ansi'
import { SuccessfulRunResult } from '../../src/lib/process'

export async function gitReset(git: SimpleGit) {
  await Promise.all([
    git.raw(['clean', '-d', '-x', '-f']),
    git.raw(['reset', '--hard']),
  ])
}

export async function gitRepo(git: SimpleGit) {
  await git.init()
  await git.raw(['add', '-A'])
  await git.raw(['commit', '--allow-empty', '--message', 'initial commit'])
}

export function withoutColors(
  result: SuccessfulRunResult
): SuccessfulRunResult {
  return {
    ...result,
    exitCode: result.exitCode,
    stdout: stripAnsi(result.stdout!),
    stderr: stripAnsi(result.stderr!),
  }
}

// todo extends Json
export function stripDynamics<C extends object>(
  dynamicPattern: string,
  content: C
): C {
  return JSON.parse(
    JSON.stringify(content)
      .split(dynamicPattern)
      .join('__DYNAMIC__')
  )
}
