import * as FS from 'fs-jetpack'
import * as Path from 'path'
import * as Layout from '.'
import { getTmpDir } from '../../utils'
import { rootLogger } from '../../utils/logger'
import { MaybePromise } from '../utils'

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

const ctx = createTestContext()

it('fails if empty file tree', async () => {
  const vfs: VirtualFS = {}

  await ctx.mockFS(vfs, async () => {
    try {
      await Layout.create()
    } catch (err) {
      expect(err.message).toContain(
        "Path you want to find stuff in doesn't exist"
      )
    }
  })
})

it('fails if no entrypoint and no graphql modules', async () => {
  const vfs: VirtualFS = {
    src: {
      'User.ts': '',
      'Post.ts': '',
    },
  }
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

  await ctx.mockFS(vfs, async () => {
    await Layout.create()
    expect(mockedStdoutBuffer).toMatchInlineSnapshot(`
      "■ nexus:layout:We could not find any graphql modules or app entrypoint
      ■ nexus:layout:Please do one of the following:

        1. Create a (graphql.ts file and write your GraphQL type definitions in it.
        2. Create a graphql directory and write your GraphQL type definitions inside files there.
        3. Create an app entrypoint; A file called any of: app.ts, server.ts, service.ts.
      "
    `)
    expect(mockExit).toHaveBeenCalledWith(1)
  })

  mockStdout.mockRestore()
  mockExit.mockRestore()
})

it('finds nested graphql modules', async () => {
  const vfs: VirtualFS = {
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
  }

  await ctx.mockFS(vfs, async () => {
    const result = await Layout.create()
    expect(ctx.normalizeLayoutResult(result.data)).toMatchInlineSnapshot(`
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
})

it('detects yarn as package manager', async () => {
  const vfs: VirtualFS = {
    'app.ts': '',
    'yarn.lock': '',
  }

  await ctx.mockFS(vfs, async () => {
    const result = await Layout.create()
    expect(
      ctx.normalizeLayoutResult(result.data).packageManagerType
    ).toMatchInlineSnapshot(`"yarn"`)
  })
})

it('finds app.ts entrypoint', async () => {
  const vfs: VirtualFS = {
    'app.ts': '',
  }

  await ctx.mockFS(vfs, async () => {
    const result = await Layout.create()
    expect(ctx.normalizeLayoutResult(result.data).app).toMatchInlineSnapshot(`
Object {
  "exists": true,
  "path": "app.ts",
}
`)
  })
})

it('finds server.ts entrypoint', async () => {
  const vfs: VirtualFS = {
    'server.ts': '',
  }

  await ctx.mockFS(vfs, async () => {
    const result = await Layout.create()
    expect(ctx.normalizeLayoutResult(result.data).app).toMatchInlineSnapshot(`
Object {
  "exists": true,
  "path": "server.ts",
}
`)
  })
})

it('finds service.ts entrypoint', async () => {
  const vfs: VirtualFS = {
    'service.ts': '',
  }

  await ctx.mockFS(vfs, async () => {
    const result = await Layout.create()
    expect(ctx.normalizeLayoutResult(result.data).app).toMatchInlineSnapshot(`
Object {
  "exists": true,
  "path": "service.ts",
}
`)
  })
})

it.todo(
  'user seeings note if multiple entrypoints found, gets feedback about which will be considered entrypoint'
)

it.todo('app.ts takes precedence over server.ts & service.ts')

it.todo('server.ts takes precedence over service.ts')

it('set app.exists = false if no entrypoint', async () => {
  const vfs: VirtualFS = {
    graphql: {
      'User.ts': '',
    },
  }

  await ctx.mockFS(vfs, async () => {
    const result = await Layout.create()
    expect(ctx.normalizeLayoutResult(result.data).app).toMatchInlineSnapshot(`
Object {
  "exists": false,
  "path": null,
}
`)
  })
})

// describe('Layout serialization save & load')

//
// Helpers
//

/**
 * In-memory file tree
 */
type VirtualFS = {
  [path: string]: string | VirtualFS
}

function createTestContext() {
  let tmpDir: null | string = null
  let originalCwd = process.cwd

  beforeEach(() => {
    tmpDir = getTmpDir('tmp-layout-test')
  })

  return {
    tmpDir,
    async mockFS(vfs: VirtualFS, hook: () => MaybePromise<void>) {
      writeToFS(tmpDir!, vfs)

      // Mock process.cwd
      process.cwd = () => {
        return tmpDir!
      }

      await hook()

      // Restore process.cwd
      process.cwd = originalCwd
    },
    normalizeLayoutResult(data: Layout.Data): Layout.Data {
      const normalizePath = (path: string): string =>
        Path.relative(tmpDir!, path)
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
    },
  }
}

function writeToFS(cwd: string, vfs: VirtualFS) {
  Object.entries(vfs).forEach(([fileOrDirName, fileContentOrDir]) => {
    const subPath = Path.join(cwd, fileOrDirName)

    if (typeof fileContentOrDir === 'string') {
      FS.write(subPath, fileContentOrDir)
    } else {
      writeToFS(subPath, { ...fileContentOrDir })
    }
  })
}
