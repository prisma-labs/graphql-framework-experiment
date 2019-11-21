import * as jetpack from 'fs-jetpack'
import * as path from 'path'
import createGit, { SimpleGit } from 'simple-git/promise'
import { createRunner, gitRepo, gitReset } from '../__helpers'

type Workspace = {
  dir: { path: string; pathRelativeToPumpkins: string; cacheHit: boolean }
  run: ReturnType<typeof createRunner>
  fs: ReturnType<typeof jetpack.dir>
  git: SimpleGit
}

async function createWorkspace(): Promise<Workspace> {
  //
  // Setup Dir
  //
  const dir = {} as Workspace['dir']
  const cacheKey = `v4-${
    jetpack.inspect('yarn.lock', {
      checksum: 'md5',
    })!.md5
  }`

  dir.path = `/tmp/pumpkins-integration-test-project-bases/${
    path.parse(__filename).name
  }-${cacheKey}`

  dir.pathRelativeToPumpkins =
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
  // Setup Project (if needed)
  //
  if (!dir.cacheHit) {
    await Promise.all([
      fs.writeAsync('package.json', {
        name: 'test-app',
        license: 'MIT',
        dependencies: {
          pumpkins: ws.dir.pathRelativeToPumpkins,
        },
        scripts: {
          postinstall:
            'yarn -s link pumpkins && chmod +x node_modules/.bin/pumpkins',
        },
      }),
      fs.writeAsync(
        'tsconfig.json',
        `
      {
        "compilerOptions": {
          "target": "es2016",
          "strict": true,
          "outDir": "dist",
          "skipLibCheck": true,
          "allowJs": true,
          "lib": ["esnext"]
        },
      }
    `
      ),
    ])

    run('yarn')
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

const ws = {} as Workspace

beforeAll(async () => {
  Object.assign(ws, await createWorkspace())
})

afterEach(async () => {
  await gitReset(ws.git)
})

describe('can build with just a schema', () => {
  it('builds', () => {
    ws.fs.write(
      'schema.ts',
      `
        objectType({
          name: 'A',
          definition(t) {
            t.string('a')
          }
        })
      `
    )

    const result = ws.run('yarn -s pumpkins build')
    expect(result).toMatchSnapshot()
    expect(ws.fs.inspectTree('dist')).toMatchSnapshot()
    // TODO ws.run('node dist/start') ...
  })
})
