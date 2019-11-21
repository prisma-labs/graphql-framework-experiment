import * as jetpack from 'fs-jetpack'
import * as tmp from 'tmp'
import * as path from 'path'
import createGit, { SimpleGit } from 'simple-git/promise'
import { createRunner, gitRepo } from '../__helpers'

type Workspace = {
  run: ReturnType<typeof createRunner>
  fs: ReturnType<typeof jetpack.dir>
  projectPath: string
  git: SimpleGit
}

async function createWorkspace(): Promise<Workspace> {
  const dir = tmp.dirSync()
  const fs = jetpack.dir(dir.name)
  const run = createRunner(dir.name)
  const projectPath = path.join(__dirname, '../..')
  const git = createGit(dir.name)

  return {
    fs,
    run,
    projectPath,
    git,
  }
}

async function createProject(c: Workspace) {
  c.fs.write('package.json', {
    name: 'test-app',
    license: 'MIT',
    // dependencies: {
    //   pumpkins: c.projectPath,
    // },
  })

  c.fs.write(
    'tsconfig.json',
    `
      {
        "compilerOptions": {
          "target": "es2016",
          "strict": true,
          "outDir": "dist",
          "skipLibCheck": true,
          "lib": ["esnext"]
        },
      }
    `
  )

  c.run('yalc add pumpkins')
  // c.run('yarn --production')
  await gitRepo(c.git)
}

const ws = {} as Workspace

beforeAll(async () => {
  Object.assign(ws, await createWorkspace())
  await createProject(ws)
})

afterEach(async () => {
  await gitReset(ws.git)
})

describe('with just schema', () => {
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
  })
})
