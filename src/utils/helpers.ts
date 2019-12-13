import * as Path from 'path'
import Git from 'simple-git/promise'

const createCodeNameGenerator = require('codename')

/**
 * Generate a random project name.
 */
export function generateProjectName(): string {
  return createCodeNameGenerator()
    .generate(['alliterative', 'random'], ['adjectives', 'animals'])
    .map((word: string | number) =>
      String(word)
        .replace(' ', '-')
        .toLowerCase()
    )
    .join('-')
}

/**
 * Get the name of the CWD or if at disk root and thus making it impossible to
 * extract a meaningful name, generate one.
 */
export function CWDProjectNameOrGenerate(): string {
  return Path.basename(process.cwd()) || generateProjectName()
}

/**
 * Creates a new git repository with an initial commit of all contents at the
 * time this function is run.
 */
export async function createGitRepository() {
  const git = Git()
  await git.init()
  await git.raw(['add', '-A'])
  await git.raw(['commit', '-m', 'initial commit'])
}
