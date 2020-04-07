/**
 * These testing utilities live here so that `nexus-plugin-prisma` can reuse them
 */

import * as FS from 'fs-jetpack'
import { IPty, IPtyForkOptions, IWindowsPtyForkOptions } from 'node-pty'
import * as Path from 'path'
import { ConnectableObservable, Observable, Subject } from 'rxjs'
import { multicast } from 'rxjs/operators'
import { Database } from '../cli/commands/create/app'
import { getTmpDir } from './fs'
import { GraphQLClient } from './graphql-client'
import { rootLogger } from './nexus-logger'
import { PackageManagerType } from './package-manager'
import stripAnsi = require('strip-ansi')

const log = rootLogger.child('e2e-testing')

interface CreateAppOptions {
  packageManagerType: PackageManagerType
  databaseType: Database | 'NO_DATABASE'
}

interface CreatePluginOptions {
  name: string
}

export function createE2EContext(config?: {
  localNexusPath?: string
  dir?: string
}) {
  rootLogger.settings({ level: 'trace' })
  process.env.LOG_LEVEL = 'trace'

  const localNexusBinPath = config?.localNexusPath
    ? Path.join(config.localNexusPath, 'dist', 'cli', 'main')
    : null
  const projectDir = config?.dir ?? getTmpDir('e2e-app')
  const PROJ_NEXUS_BIN_PATH = Path.join(
    projectDir,
    'node_modules',
    '.bin',
    'nexus'
  )
  log.trace('setup', { projectDir, config })

  FS.dir(projectDir)

  const contextAPI = {
    dir: projectDir,
    settings: config,
    getTmpDir: getTmpDir,
    fs: FS.cwd(projectDir),
    client: new GraphQLClient('http://localhost:4000/graphql'),
    node(args: string[], opts: IPtyForkOptions = {}) {
      return spawn('node', args, { cwd: projectDir, ...opts })
    },
    spawn(binPathAndArgs: string[], opts: IPtyForkOptions = {}) {
      const [binPath, ...args] = binPathAndArgs
      return spawn(binPath, args, { cwd: projectDir, ...opts })
    },
    nexus(args: string[], opts: IPtyForkOptions = {}) {
      return spawn(PROJ_NEXUS_BIN_PATH, args, { cwd: projectDir, ...opts })
    },
    npxNexus(options: { nexusVersion: string }, args: string[]) {
      return spawn('npx', [`nexus-future@${options.nexusVersion}`, ...args], {
        cwd: projectDir,
        env: {
          ...process.env,
          LOG_LEVEL: 'trace',
        },
      })
    },
    npxNexusCreatePlugin(
      options: CreatePluginOptions & { nexusVersion: string }
    ) {
      return spawn(
        'npx',
        [`nexus-future@${options.nexusVersion}`, 'create', 'plugin'],
        {
          cwd: projectDir,
          env: {
            ...process.env,
            CREATE_PLUGIN_CHOICE_NAME: options.name,
            LOG_LEVEL: 'trace',
          },
        }
      )
    },
    npxNexusCreateApp(options: CreateAppOptions & { nexusVersion: string }) {
      return spawn('npx', [`nexus@${options.nexusVersion}`], {
        cwd: projectDir,
        env: {
          ...process.env,
          CREATE_APP_CHOICE_PACKAGE_MANAGER_TYPE: options.packageManagerType,
          CREATE_APP_CHOICE_DATABASE_TYPE: options.databaseType,
          LOG_LEVEL: 'trace',
        },
      })
    },
    localNexus(args: string[]) {
      if (!localNexusBinPath)
        throw new Error(
          'E2E Config Error: Cannot run localNexus because you did not configure config.localNexusBinPath'
        )
      return spawn('node', [localNexusBinPath, ...args], {
        cwd: projectDir,
        env: {
          ...process.env,
          LOG_LEVEL: 'trace',
        },
      })
    },
    localNexusCreateApp(options: CreateAppOptions) {
      if (!localNexusBinPath)
        throw new Error(
          'E2E Config Error: Cannot run localNexusCreateApp because you did not configure config.localNexusBinPath'
        )
      return spawn('node', [localNexusBinPath], {
        cwd: projectDir,
        env: {
          ...process.env,
          CREATE_APP_CHOICE_PACKAGE_MANAGER_TYPE: options.packageManagerType,
          CREATE_APP_CHOICE_DATABASE_TYPE: options.databaseType,
          LOG_LEVEL: 'trace',
        },
      })
    },
    localNexusCreatePlugin(options: CreatePluginOptions) {
      if (!localNexusBinPath)
        throw new Error(
          'E2E Config Error: Cannot run localNexusCreatePlugin because you did not configure config.localNexusBinPath'
        )
      return spawn('node', [localNexusBinPath, 'create', 'plugin'], {
        cwd: projectDir,
        env: {
          ...process.env,
          CREATE_PLUGIN_CHOICE_NAME: options.name,
          LOG_LEVEL: 'trace',
        },
      })
    },
  }

  if (config?.localNexusPath) {
    process.env.CREATE_APP_CHOICE_NEXUS_VERSION = `file:${config.localNexusPath}`
  }

  return contextAPI
}

export function spawn(
  command: string,
  args: string[],
  opts: IPtyForkOptions
): ConnectableObservable<string> {
  const nodePty = requireNodePty()
  const subject = new Subject<string>()
  const ob = new Observable<string>((sub) => {
    const proc = nodePty.spawn(command, args, {
      cols: process.stdout.columns ?? 80,
      rows: process.stdout.rows ?? 80,
      ...opts,
    })

    proc.on('data', (data) => {
      process.stdout.write(data)
      sub.next(stripAnsi(data))
    })

    proc.on('exit', (exitCode, signal) => {
      const result = {
        exitCode: exitCode,
        signal: signal,
      }

      if (exitCode !== 0) {
        const error = new Error(
          `command "${command} ${args.join(' ')}" exited ${exitCode}`
        )
        Object.assign(error, result)
        sub.error(error)
      } else {
        sub.complete()
      }
    })

    return function unsub() {
      proc.kill()
    }
  })

  const multicasted = ob.pipe(multicast(subject)) as ConnectableObservable<
    string
  >

  return multicasted
}

interface NodePty {
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
