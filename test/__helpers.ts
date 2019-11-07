import { spawnSync, SpawnSyncOptions } from 'child_process'
import * as path from 'path'
import * as fs from 'fs-jetpack'
import Git from 'simple-git/promise'
import { unlinkSync } from 'fs'
import { dirSync, DirResult } from 'tmp'

type RunResult = { stderr: string; stdout: string; status: null | number }
type RunOptions = Omit<SpawnSyncOptions, 'encoding'>

const run = (command: string, options?: RunOptions): RunResult => {
  const [name, ...args] = command.split(' ')
  const { stderr, stdout, status } = spawnSync(name, args, {
    ...options,
    encoding: 'utf8',
  })
  return { stderr, stdout, status }
}

const createCLIRunner = (optionsBase?: RunOptions) => (
  command: string,
  options?: RunOptions
) => {
  const mergedOptions = { ...optionsBase, ...options }
  // TODO Why is the extra `../` needed...
  const entrypint = 'src/cli/index.ts'
  const pathToProject =
    '../' +
    path.relative(
      (mergedOptions as any)['cwd'] || '.',
      path.join(__dirname, '..')
    )
  // console.log(pathToProject)
  return run(
    `${pathToProject}/node_modules/.bin/ts-node --project ${pathToProject}/tsconfig.json ${pathToProject}/${entrypint} ${command}`,
    mergedOptions
  )
}

type GitFixture = {
  git: Git.SimpleGit
  tmpDir: DirResult
  cli: ReturnType<typeof createCLIRunner>
  setupRepo: () => Promise<void>
}

const createGitFixture = (): GitFixture => {
  const tmpDir = dirSync({
    postfix: `_test_${path.basename(__filename, '.ts')}`,
  })
  const git = Git(tmpDir.name)
  const cli = createCLIRunner({ cwd: tmpDir.name })
  // console.log(tmpDir.name)
  const setupRepo = async () => {
    await git.init()
    await git.raw(['commit', '--allow-empty', '--message', 'initial commit'])
  }

  return {
    tmpDir,
    git,
    cli,
    setupRepo,
  }
}

const useGitFixture = (): GitFixture => {
  // Create an object that is returned.
  // Our before{All,Each} hooks mutate it.
  // Thus the test suite can lazily read the props
  // in test blocks.
  let gitFixture = {} as GitFixture

  beforeAll(async () => {
    Object.assign(gitFixture, createGitFixture())
  })

  beforeEach(async () => {
    await fs.dir(gitFixture.tmpDir.name, { empty: true })
    await gitFixture.setupRepo()
  })

  return gitFixture as any
}

export { run, createCLIRunner, useGitFixture }
