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

const log = rootLogger.child('e2e-testing')

export function setupE2EContext(config?: {
  testProjectDir?: string
  /**
   * If enabled then:
   *
   * 1. The generated typegen imports will be re-written to not expect @nexus/schema to be hoisted
   * 2. The Nexus version scaffolded by create app flow in the app's package.json is a path to literally this package on disk.
   */
  linkedPackageMode?: boolean
}) {
  const projectDir = config?.testProjectDir ?? getTmpDir('nexus-prisma-tmp-')
  const NEXUS_BIN_PATH = Path.join(projectDir, 'node_modules', '.bin', 'nexus')
  log.trace('setup', { projectDir, config })

  FS.dir(projectDir)

  const contextAPI = {
    client: new GraphQLClient('http://localhost:4000/graphql'),
    projectDir: projectDir,
    spawnNexus(
      args: string[],
      expectHandler: (data: string, proc: IPty) => void = () => {},
      opts: IPtyForkOptions = {}
    ) {
      return ptySpawn(
        NEXUS_BIN_PATH,
        args,
        {
          cwd: projectDir,
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
      log.trace('npx nexus-future', {
        version,
        packageManagerType,
        databaseType,
      })
      return ptySpawn(
        'npx',
        [`nexus-future@${version}`],
        {
          cwd: projectDir,
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
    spawnNexusFromBuild(
      args: string[],
      expectHandler: (data: string, proc: IPty) => void = () => {}
    ) {
      const projectPath = Path.join(__dirname, '../../')
      const buildPath = Path.join(projectPath, '/dist/')
      const cliPath = Path.join(buildPath, '/cli/main')
      return ptySpawn(
        'node',
        [cliPath, ...args],
        {
          cwd: projectDir,
        },
        (data, proc) => expectHandler(stripAnsi(data), proc)
      )
    },
  }

  if (config?.linkedPackageMode) {
    // Handling no-hoist problem - https://github.com/graphql-nexus/nexus-future/issues/432
    process.env.NEXUS_TYPEGEN_NEXUS_SCHEMA_IMPORT_PATH = `"../../nexus-future/node_modules/@nexus/schema"`
    process.env.CREATE_APP_CHOICE_NEXUS_FUTURE_VERSION_EXPRESSION = `file:${getRelativePathFromTestProjectToNexusPackage()}`
  }

  return contextAPI

  //
  // helpers
  //

  function getRelativePathFromTestProjectToNexusPackage() {
    const nexusPackagePath = Path.join(__dirname, '../../')
    return Path.join('..', Path.relative(projectDir, nexusPackagePath))
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
