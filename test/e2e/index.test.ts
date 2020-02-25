import * as FS from 'fs-jetpack'
import * as NodePty from 'node-pty'
import * as OS from 'os'
import * as Path from 'path'
import stripAnsi from 'strip-ansi'
import { Database } from '../../src/cli/commands/create/app'
import { PackageManagerType } from '../../src/utils/package-manager'
import { ptySpawn } from './pty-spawn'
import { GraphQLClient } from '../../src/lib/graphql-client'

function getTmpDir() {
  const uniqId = Math.random()
    .toString()
    .slice(2)
  const tmpDir = Path.join(OS.tmpdir(), `nexus-prisma-tmp-${uniqId}`)

  // Create dir
  FS.dir(tmpDir)

  return tmpDir
}

function setupE2EContext() {
  const tmpDir = getTmpDir()
  const LOCAL_BIN_PATH = FS.path('dist', 'cli', 'main.js')
  const RELATIVE_BIN_PATH = Path.join(tmpDir, 'node_modules', '.bin', 'nexus')

  console.log({
    tmpDir,
  })

  FS.dir(tmpDir)

  afterEach(() => {
    //FS.remove(tmpDir)
  })

  return {
    tmpDir,
    spawnNexus(
      args: string[],
      expectHandler: (data: string, proc: NodePty.IPty) => void = () => {},
      opts: NodePty.IPtyForkOptions = {}
    ) {
      //return Process.run(`${BIN_PATH} ${args}`, { cwd: tmpDir })
      return ptySpawn(
        RELATIVE_BIN_PATH,
        args,
        {
          cwd: tmpDir,
          // env: {
          //   ...process.env,
          //   LOG_PRETTY: 'false',
          // },
          ...opts,
        },
        expectHandler
      )
    },
    spawnInit(
      packageManager: PackageManagerType,
      database: Database | 'NO_DATABASE',
      expectHandler: (data: string, proc: NodePty.IPty) => void
    ) {
      return ptySpawn(
        'node',
        [LOCAL_BIN_PATH],
        {
          cwd: tmpDir,
          env: {
            ...process.env,
            PACKAGE_MANAGER_CHOICE: packageManager,
            DATABASE_CHOICE: database,
            //LOG_PRETTY: 'false',
          },
        },
        expectHandler
      )
    },
    client: new GraphQLClient('http://localhost:4000/graphql'),
  }
}

const ctx = setupE2EContext()

test('e2e', async () => {
  // Run npx nexus-future and kill process
  const initResult = await ctx.spawnInit('npm', 'NO_DATABASE', (data, proc) => {
    if (stripAnsi(data).includes('server:listening')) {
      proc.kill()
    }
  })

  expect(stripAnsi(initResult.data)).toContain('server:listening')
  expect(initResult.exitCode).toStrictEqual(0)

  // Run nexus dev and query graphql api
  await ctx.spawnNexus(['dev'], async (data, proc) => {
    if (stripAnsi(data).includes('server:listening')) {
      const queryResult = await ctx.client.request(`{
        worlds {
          id
          name
          population
        }
      }`)

      expect(queryResult).toMatchInlineSnapshot(`
        Object {
          "worlds": Array [
            Object {
              "id": "1",
              "name": "Earth",
              "population": 6000000,
            },
            Object {
              "id": "2",
              "name": "Mars",
              "population": 0,
            },
          ],
        }
      `)
      proc.kill()
    }
  })

  // Run nexus build
  const res = await ctx.spawnNexus(['build'], () => {})

  expect(stripAnsi(res.data)).toContain('success')
  expect(res.exitCode).toStrictEqual(0)
})
