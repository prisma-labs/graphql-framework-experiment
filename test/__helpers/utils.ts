import { SimpleGit } from 'simple-git/promise'
import stripAnsi from 'strip-ansi'
import { RunResult } from './run'

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

export function withoutColors(result: RunResult): RunResult {
  return {
    status: result.status,
    stdout: stripAnsi(result.stdout),
    stderr: stripAnsi(result.stderr),
  }
}
