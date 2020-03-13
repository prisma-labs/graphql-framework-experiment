import * as Path from 'path'
import * as Layout from '.'
import { rootLogger } from '../../lib/nexus-logger'
import { MemoryFS, writeToFS } from '../../lib/testing-utils'
import * as TestContext from '../test-context'

/**
 * Disable logger timeDiff and color to allow snapshot matching
 */
rootLogger.settings({
  pretty: {
    enabled: true,
    timeDiff: false,
    color: false,
  },
})

/**
 * Helpers
 */

const layoutContext = TestContext.create(
  (opts: TestContext.TmpDirContribution) => {
    return {
      setup(vfs: MemoryFS) {
        const tmpDir = opts.tmpDir()

        writeToFS(tmpDir, vfs)
      },
      async scan() {
        const tmpDir = opts.tmpDir()
        const data = await Layout.create({ cwd: tmpDir })

        return normalizeLayoutResult(tmpDir, data.data)
      },
    }
  }
)

function normalizeLayoutResult(tmpDir: string, data: Layout.Data): Layout.Data {
  const normalizePath = (path: string): string => Path.relative(tmpDir, path)
  const app: Layout.Data['app'] = data.app.exists
    ? {
        exists: true,
        path: normalizePath(data.app.path),
      }
    : { exists: false, path: null }

  return {
    ...data,
    app,
    projectRoot: normalizePath(data.projectRoot),
    schemaModules: data.schemaModules.map(m => normalizePath(m)),
    sourceRoot: normalizePath(data.sourceRoot),
  }
}

const ctx = TestContext.compose(TestContext.tmpDir, layoutContext)

it('fails if empty file tree', async () => {
  ctx.setup({})

  try {
    await ctx.scan()
  } catch (err) {
    expect(err.message).toContain(
      "Path you want to find stuff in doesn't exist"
    )
  }
})

it('fails if no entrypoint and no graphql modules', async () => {
  ctx.setup({
    src: {
      'User.ts': '',
      'Post.ts': '',
    },
  })

  let mockedStdoutBuffer: string = ''
  const mockStdout = jest
    .spyOn(process.stdout, 'write')
    .mockImplementation(data => {
      mockedStdoutBuffer += data

      return true
    })
  const mockExit = jest
    .spyOn(process, 'exit')
    .mockImplementation((() => {}) as any)

  await ctx.scan()

  expect(mockedStdoutBuffer).toMatchInlineSnapshot(`
      "■ nexus:layout:We could not find any graphql modules or app entrypoint
      ■ nexus:layout:Please do one of the following:

        1. Create a (graphql.ts file and write your GraphQL type definitions in it.
        2. Create a graphql directory and write your GraphQL type definitions inside files there.
        3. Create an app entrypoint; A file called any of: app.ts, server.ts, service.ts.
      "
    `)
  expect(mockExit).toHaveBeenCalledWith(1)

  mockStdout.mockRestore()
  mockExit.mockRestore()
})

it('finds nested graphql modules', async () => {
  ctx.setup({
    src: {
      'app.ts': '',
      graphql: {
        '1.ts': '',
        '2.ts': '',
        graphql: {
          '3.ts': '',
          '4.ts': '',
          graphql: {
            '5.ts': '',
            '6.ts': '',
          },
        },
      },
    },
  })

  const result = await ctx.scan()

  expect(result).toMatchInlineSnapshot(`
    Object {
      "app": Object {
        "exists": true,
        "path": "src/app.ts",
      },
      "buildOutput": "node_modules/.build",
      "packageManagerType": "npm",
      "project": Object {
        "isAnonymous": true,
        "name": "anonymous",
      },
      "projectRoot": "",
      "schemaModules": Array [
        "src/graphql/1.ts",
        "src/graphql/2.ts",
        "src/graphql/graphql/3.ts",
        "src/graphql/graphql/4.ts",
        "src/graphql/graphql/graphql/5.ts",
        "src/graphql/graphql/graphql/6.ts",
      ],
      "sourceRoot": "src",
      "sourceRootRelative": "src",
    }
  `)
})

it('detects yarn as package manager', async () => {
  ctx.setup({
    'app.ts': '',
    'yarn.lock': '',
  })

  const result = await ctx.scan()

  expect(result.packageManagerType).toMatchInlineSnapshot(`"yarn"`)
})

it('finds app.ts entrypoint', async () => {
  ctx.setup({
    'app.ts': '',
  })

  const result = await ctx.scan()

  expect(result.app).toMatchInlineSnapshot(`
Object {
  "exists": true,
  "path": "app.ts",
}
`)
})

it('finds server.ts entrypoint', async () => {
  ctx.setup({
    'server.ts': '',
  })

  const result = await ctx.scan()

  expect(result.app).toMatchInlineSnapshot(`
Object {
  "exists": true,
  "path": "server.ts",
}
`)
})

it('finds service.ts entrypoint', async () => {
  ctx.setup({
    'service.ts': '',
  })

  const result = await ctx.scan()

  expect(result.app).toMatchInlineSnapshot(`
Object {
  "exists": true,
  "path": "service.ts",
}
`)
})

it('set app.exists = false if no entrypoint', async () => {
  await ctx.setup({
    graphql: {
      'User.ts': '',
    },
  })

  const result = await ctx.scan()

  expect(result.app).toMatchInlineSnapshot(`
Object {
  "exists": false,
  "path": null,
}
`)
})

it.todo(
  'user seeings note if multiple entrypoints found, gets feedback about which will be considered entrypoint'
)

// TODO: Currently works but seems like it's only thanks to lexical sort
it('app.ts takes precedence over server.ts & service.ts', async () => {
  ctx.setup({
    'service.ts': '',
    'app.ts': '',
  })

  const result = await ctx.scan()

  expect(result).toMatchInlineSnapshot(`
Object {
  "app": Object {
    "exists": true,
    "path": "app.ts",
  },
  "buildOutput": "node_modules/.build",
  "packageManagerType": "npm",
  "project": Object {
    "isAnonymous": true,
    "name": "anonymous",
  },
  "projectRoot": "",
  "schemaModules": Array [],
  "sourceRoot": "",
  "sourceRootRelative": "./",
}
`)
})

// TODO: Currently works but seems like it's only thanks to lexical sort
it('server.ts takes precedence over service.ts', async () => {
  ctx.setup({
    'server.ts': '',
    'service.ts': '',
  })

  const result = await ctx.scan()

  expect(result).toMatchInlineSnapshot(`
Object {
  "app": Object {
    "exists": true,
    "path": "server.ts",
  },
  "buildOutput": "node_modules/.build",
  "packageManagerType": "npm",
  "project": Object {
    "isAnonymous": true,
    "name": "anonymous",
  },
  "projectRoot": "",
  "schemaModules": Array [],
  "sourceRoot": "",
  "sourceRootRelative": "./",
}
`)
})
