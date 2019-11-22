import { SimpleGit } from 'simple-git/promise'

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
