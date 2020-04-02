import * as jetpack from 'fs-jetpack'
import * as path from 'path'
import createGit, { SimpleGit } from 'simple-git/promise'
import { createRunner } from '../../src/lib/process'
import { gitRepo, gitReset } from './utils'

type Workspace = {
  dir: { path: string; pathRelativeTonexusFuture: string; cacheHit: boolean }
  run: ReturnType<typeof createRunner>
  fs: ReturnType<typeof jetpack.dir>
  git: SimpleGit
}

type Options = {
  name: string
  cacheVersion?: string
}

/**
 * Workspace creator coupled to jest.
 */
export function createWorkspace(config: Options): Workspace {
  const ws = {} as Workspace

  beforeAll(async () => {
    Object.assign(ws, await doCreateWorkspace({ name: config.name }))
    // In case of a cache hit where we manually debugged the directory or
    // somehow else it changed.
    await gitReset(ws.git)
    // HACK without this the nexus bin is missing because its a diff undone by the reset
    ws.run('yarn --force', { require: true })
  })

  return ws
}

// TODO if errors occur during workspace creation then the cache will be hit
// next time but actual contents not suitable for use. Make the system more robust!

/**
 * Core workspace creator, decoupled from jest.
 */
async function doCreateWorkspace(config: Options): Promise<Workspace> {
  //
  // Setup Dir
  //
  const dir = {} as Workspace['dir']
  const yarnLockHash = jetpack.inspect('yarn.lock', {
    checksum: 'md5',
  })!.md5
  const ver = '6'
  const testVer = config.cacheVersion ?? '1'
  const currentGitBranch = (
    await createGit().raw(['rev-parse', '--abbrev-ref', 'HEAD'])
  ).trim()
  const cacheKey = `v${ver}-yarnlock-${yarnLockHash}-gitbranch-${currentGitBranch}-testv${testVer}`

  dir.path = `/tmp/nexus-integration-test-project-bases/${config.name}-${cacheKey}`

  dir.pathRelativeTonexusFuture =
    '../' + path.relative(dir.path, path.join(__dirname, '../..'))

  if ((await jetpack.existsAsync(dir.path)) !== false) {
    dir.cacheHit = true
  } else {
    dir.cacheHit = false
    await jetpack.dirAsync(dir.path)
  }

  console.log('cache %s for %s', dir.cacheHit ? 'hit' : 'miss', dir.path)

  //
  // Setup Tools
  //
  const fs = jetpack.dir(dir.path)
  const run = createRunner(dir.path)
  const git = createGit(dir.path)

  //
  // Setup Project (if needed, cacheable)
  //
  if (!dir.cacheHit) {
    await Promise.all([
      fs.writeAsync('package.json', {
        name: 'test-app',
        license: 'MIT',
        dependencies: {
          nexus: dir.pathRelativeTonexusFuture,
        },
        scripts: {
          postinstall: 'yarn -s link nexus && chmod +x node_modules/.bin/nexus',
        },
      }),
      fs.writeAsync(
        'tsconfig.json',
        `
      {
        "compilerOptions": {
          "target": "es2016",
          "strict": true,
          "allowJs": true,
          "lib": ["esnext"]
        },
      }
    `
      ),
    ])

    run('yarn', { require: true })
    await gitRepo(git)
  }

  //
  // Return a workspace
  //
  return {
    dir,
    fs,
    run,
    git,
  }
}
