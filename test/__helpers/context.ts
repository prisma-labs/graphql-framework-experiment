import * as fs from 'fs-jetpack'
import Git from 'simple-git/promise'
import { dirSync, DirResult } from 'tmp'
import * as path from 'path'
import { createCLIRunner, run, createRunner } from './run'

type CreateFixture<C> = (ctx: C) => () => C

type ContextBuilder<C extends {}> = {
  use: <C2 extends {}>(
    createFixture: CreateFixture<C2>
  ) => ContextBuilder<C & C2>
  build: () => C
}

export const withContext = <C extends {}>(
  maybeContext?: C
): ContextBuilder<C> => {
  // Create an object that is returned. Our before{All,Each} hooks mutate it.
  // Thus the test suite can lazily read the prop in test blocks.
  //
  // We need the as-cast because a fallback of {} may not conform to constraint of passed
  // type variable. So technically this is not safe but in practice this is how
  // it will be used. We can probably use conditional types to avoid this hack?...
  // context = context ?? ({} as any)
  const context = maybeContext ?? ({} as C)

  const use = <C2 extends {}>(createFixture: CreateFixture<C2>) => {
    // We need the any-cast becuase context is the wrong type now, but used in
    // jest hooks, will be the right type
    const fixture = createFixture((context as any) as C2)

    // Create the fixutre once only before all tests
    // TODO If we wanted the fixture to be created before each test we could put
    // this logic into beforeEach. Need to think about the use-cases and
    // patterns around this, e.g. config passed from where by who etc.
    beforeAll(() => {
      const contextProvided = fixture()
      Object.assign(context, contextProvided)
    })

    return withContext<C & C2>(context as C & C2)
  }

  const build = () => {
    return context
  }

  const api = {
    use,
    build,
  }

  return api
}

type GitFixture = {
  git: Git.SimpleGit
  tmpDir: DirResult
  cli: ReturnType<typeof createCLIRunner>
  fs: typeof fs
  pathAbsoluteToProject: string
  setupRepo: () => Promise<void>
  run: typeof run
}

export const gitFixture: CreateFixture<GitFixture> = ctx => {
  beforeEach(async () => {
    await ctx.fs.dir(ctx.tmpDir.name, { empty: true })
    await ctx.setupRepo()
  })

  return () => {
    const tmpDir = dirSync({
      postfix: `_test_${path.basename(__filename, '.ts')}`,
    })
    const localGit = Git(tmpDir.name)
    const localFS = fs.cwd(tmpDir.name)
    const localCLI = createCLIRunner({ cwd: tmpDir.name })
    const localRun = createRunner(tmpDir.name)
    const pathAbsoluteToProject = path.join(__dirname, '../..')
    // console.log(tmpDir.name)
    const setupRepo = async () => {
      await localGit.init()
      await localGit.raw([
        'commit',
        '--allow-empty',
        '--message',
        'initial commit',
      ])
    }

    return {
      tmpDir,
      git: localGit,
      cli: localCLI,
      fs: localFS,
      run: localRun,
      setupRepo,
      pathAbsoluteToProject,
    }
  }
}

export const setupBasePumpkinsProject = (
  c: GitFixture,
  config?: { package?: any }
) => {
  c.fs.write('package.json', {
    name: 'test-app',
    dependencies: {
      pumpkins: c.pathAbsoluteToProject,
    },
    license: 'MIT',
    ...config?.package,
  })

  c.run('yarn')

  // HACK to work around oclif failing on import error
  c.run('rm -rf node_modules/pumpkins/src')

  c.fs.write(
    'tsconfig.json',
    `
      {
        "compilerOptions": {
          "target": "es2016",
          "strict": true,
          "outDir": "dist",
          "lib": ["esnext"]
        },
      }
    `
  )
}
