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

import * as Layout from '.'
import { rootLogger } from '../../lib/nexus-logger'
import { MemoryFS, writeToFS } from '../../lib/testing-utils'
import * as TestContext from '../test-context'
import { repalceInObject } from '../utils'

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
        return repalceInObject(tmpDir, '__DYNAMIC__', data.data)
      },
    }
  }
)

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

  await ctx.scan()

  expect(mockedStdoutBuffer).toMatchInlineSnapshot(`
    "■ nexus:layout We could not find any graphql modules or app entrypoint
    ■ nexus:layout Please do one of the following:

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
        "path": "__DYNAMIC__/src/app.ts",
      },
      "buildOutputRelative": "node_modules/.build",
      "packageManagerType": "npm",
      "project": Object {
        "isAnonymous": true,
        "name": "anonymous",
      },
      "projectRoot": "__DYNAMIC__",
      "schemaModules": Array [
        "__DYNAMIC__/src/graphql/1.ts",
        "__DYNAMIC__/src/graphql/2.ts",
        "__DYNAMIC__/src/graphql/graphql/3.ts",
        "__DYNAMIC__/src/graphql/graphql/4.ts",
        "__DYNAMIC__/src/graphql/graphql/graphql/5.ts",
        "__DYNAMIC__/src/graphql/graphql/graphql/6.ts",
      ],
      "sourceRoot": "__DYNAMIC__/src",
      "sourceRootRelative": "src",
      "startModuleInPath": "__DYNAMIC__/src/index.ts",
      "startModuleOutPath": "__DYNAMIC__/node_modules/.build/index.js",
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
      "path": "__DYNAMIC__/app.ts",
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
      "path": "__DYNAMIC__/server.ts",
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
      "path": "__DYNAMIC__/service.ts",
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
        "path": "__DYNAMIC__/app.ts",
      },
      "buildOutputRelative": "node_modules/.build",
      "packageManagerType": "npm",
      "project": Object {
        "isAnonymous": true,
        "name": "anonymous",
      },
      "projectRoot": "__DYNAMIC__",
      "schemaModules": Array [],
      "sourceRoot": "__DYNAMIC__",
      "sourceRootRelative": "./",
      "startModuleInPath": "__DYNAMIC__/index.ts",
      "startModuleOutPath": "__DYNAMIC__/node_modules/.build/index.js",
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
        "path": "__DYNAMIC__/server.ts",
      },
      "buildOutputRelative": "node_modules/.build",
      "packageManagerType": "npm",
      "project": Object {
        "isAnonymous": true,
        "name": "anonymous",
      },
      "projectRoot": "__DYNAMIC__",
      "schemaModules": Array [],
      "sourceRoot": "__DYNAMIC__",
      "sourceRootRelative": "./",
      "startModuleInPath": "__DYNAMIC__/index.ts",
      "startModuleOutPath": "__DYNAMIC__/node_modules/.build/index.js",
    }
  `)
})

it('takes shallowest path for sourceRoot', async () => {
  ctx.setup({
    src: {
      '1': {
        'graphql.ts': '',
      },
      '2': {
        'graphql.ts': '',
      },
      'graphql.ts': '',
    },
  })

  const result = await ctx.scan()

  expect(result.sourceRoot).toMatchInlineSnapshot(`"__DYNAMIC__/src"`)
})
