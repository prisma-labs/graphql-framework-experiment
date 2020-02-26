/**
 * These testing utilities lives here so that `nexus-plugin-prisma` can reuse them
 */

import { Database } from '../cli/commands/create/app'
import { PackageManagerType } from './package-manager'
import { GraphQLClient } from '../lib/graphql-client'
import * as FS from 'fs-jetpack'
import { IPtyForkOptions, IWindowsPtyForkOptions, IPty } from 'node-pty'
import * as OS from 'os'
import * as Path from 'path'
import { rootLogger } from './logger'

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
      expectHandler: (data: string, proc: IPty) => void = () => {},
      opts: IPtyForkOptions = {}
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
      version: string,
      expectHandler: (data: string, proc: IPty) => void
    ) {
      return ptySpawn(
        'npx',
        [`nexus-future${version}`],
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
  opts: IPtyForkOptions,
  expectHandler: (data: string, proc: IPty) => void
) {
  const nodePty = requireNodePty()

  return new Promise<{ exitCode: number; signal?: number; data: string }>(
    resolve => {
      const proc = nodePty.spawn(command, args, {
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

/**
 * TODO: Once we have TS 3.8, remove that custom type and use the type from the module itself using the `import type` syntax
 */
type NodePty = {
  spawn: (
    file: string,
    args: string[] | string,
    options: IPtyForkOptions | IWindowsPtyForkOptions
  ) => IPty
}

function requireNodePty(): NodePty {
  try {
    return require('node-pty') as NodePty
  } catch (e) {
    rootLogger.error(
      'Could not require `node-pty`. Please install it as a dev dependency'
    )
    throw e
  }
}
