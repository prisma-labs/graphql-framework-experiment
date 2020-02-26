/**
 * These testing utilities lives here so that `nexus-plugin-prisma` can reuse them
 */
import { Database } from '../cli/commands/create/app'
import { PackageManagerType } from './package-manager'
import { GraphQLClient } from '../lib/graphql-client'
import * as FS from 'fs-jetpack'
import * as NodePty from 'node-pty'
import * as OS from 'os'
import * as Path from 'path'

export function setupE2EContext() {
  const tmpDir = getTmpDir()
  const RELATIVE_BIN_PATH = Path.join(tmpDir, 'node_modules', '.bin', 'nexus')

  FS.dir(tmpDir)

  afterEach(() => {
    FS.remove(tmpDir)
  })

  return {
    tmpDir,
    spawnNexus(
      args: string[],
      expectHandler: (data: string, proc: NodePty.IPty) => void = () => {},
      opts: NodePty.IPtyForkOptions = {}
    ) {
      return ptySpawn(
        RELATIVE_BIN_PATH,
        args,
        {
          cwd: tmpDir,
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
      if (!process.env.PR) {
        throw new Error('Could not find env var `PR`')
      }

      return ptySpawn(
        'npx',
        [`nexus-future@pr.${process.env.PR}`],
        {
          cwd: tmpDir,
          env: {
            ...process.env,
            PACKAGE_MANAGER_CHOICE: packageManager,
            DATABASE_CHOICE: database,
          },
        },
        expectHandler
      )
    },
    client: new GraphQLClient('http://localhost:4000/graphql'),
  }
}

function getTmpDir() {
  const uniqId = Math.random()
    .toString()
    .slice(2)
  const tmpDir = Path.join(OS.tmpdir(), `nexus-prisma-tmp-${uniqId}`)

  // Create dir
  FS.dir(tmpDir)

  return tmpDir
}

export function ptySpawn(
  command: string,
  args: string[],
  opts: NodePty.IPtyForkOptions,
  expectHandler: (data: string, proc: NodePty.IPty) => void
) {
  return new Promise<{ exitCode: number; signal?: number; data: string }>(
    resolve => {
      const proc = NodePty.spawn(command, args, {
        cols: 80,
        rows: 80,
        ...opts,
      })
      let buffer = ''

      proc.on('data', data => {
        buffer += data
        expectHandler(data, proc)
      })

      proc.on('exit', (exitCode, signal) => {
        resolve({ exitCode, signal, data: buffer })
      })
    }
  )
}
