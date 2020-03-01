/**
 * These testing utilities lives here so that `nexus-plugin-prisma` can reuse them
 */

import * as FS from 'fs-jetpack'
import { IPty, IPtyForkOptions, IWindowsPtyForkOptions } from 'node-pty'
import * as Path from 'path'
import { Database } from '../cli/commands/create/app'
import { GraphQLClient } from '../lib/graphql-client'
import { getTmpDir } from './fs'
import { rootLogger } from './logger'
import { PackageManagerType } from './package-manager'
import stripAnsi = require('strip-ansi')

export function setupE2EContext(nexusOutputDir?: string) {
  const tmpDir = nexusOutputDir ?? getTmpDir('nexus-prisma-tmp-')
  const NEXUS_BIN_PATH = Path.join(tmpDir, 'node_modules', '.bin', 'nexus')

  FS.dir(tmpDir)

  return {
    tmpDir,
    spawnNexus(
      args: string[],
      expectHandler: (data: string, proc: IPty) => void = () => {},
      opts: IPtyForkOptions = {}
    ) {
      return ptySpawn(
        NEXUS_BIN_PATH,
        args,
        {
          cwd: tmpDir,
          ...opts,
        },
        (data, proc) => expectHandler(stripAnsi(data), proc)
      )
    },
    spawnNPXNexus(
      packageManagerType: PackageManagerType,
      databaseType: Database | 'NO_DATABASE',
      version: string,
      expectHandler: (data: string, proc: IPty) => void
    ) {
      return ptySpawn(
        'npx',
        [`nexus-future@${version}`],
        {
          cwd: tmpDir,
          env: {
            ...process.env,
            CREATE_APP_CHOICE_PACKAGE_MANAGER_TYPE: packageManagerType,
            CREATE_APP_CHOICE_DATABASE_TYPE: databaseType,
            LOG_LEVEL: 'trace',
          },
        },
        (data, proc) => expectHandler(stripAnsi(data), proc)
      )
    },
    client: new GraphQLClient('http://localhost:4000/graphql'),
  }
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
        resolve({ exitCode, signal, data: stripAnsi(buffer) })
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
