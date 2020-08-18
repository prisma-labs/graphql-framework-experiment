/**
 * These testing utilities live here so that `nexus-plugin-prisma` can reuse them
 */

import * as Logger from '@nexus/logger'
import * as FS from 'fs-jetpack'
import { IPty, IPtyForkOptions, IWindowsPtyForkOptions } from 'node-pty'
import * as os from 'os'
import * as Path from 'path'
import { ConnectableObservable, Observable, Subject } from 'rxjs'
import { multicast } from 'rxjs/operators'
import stripAnsi from 'strip-ansi'
import * as which from 'which'
import { Database } from '../cli/commands/create/app'
import { GraphQLClient } from '../lib/graphql-client'
import { getTmpDir } from './fs'
import { rootLogger } from './nexus-logger'
import { PackageManagerType } from './package-manager'

const log = rootLogger.child('e2eTesting')

interface CreateAppOptions {
  /**
   * Sets the NEXUS_PLUGIN_PRISMA_VERSION envar.
   *
   * Only useful if _not_ using NO_DATABASE for `databaseType`.
   *
   * @defualt 'latest'
   */
  prismaPluginVersion?: string
  packageManagerType: PackageManagerType
  databaseType: Database | 'NO_DATABASE'
}

interface CreatePluginOptions {
  name: string
}

export type E2EContext = ReturnType<typeof createE2EContext>

interface Config {
  dir?: string
  /**
   * The port that the server will listen on and tht graphql client will make
   * requests at.
   */
  serverPort?: number
  /**
   * The absolute path to a source checkout of Nexus. The Nexus checkout should
   * be built as well.
   *
   * If this is present then the e2e test can run it for app creation instead
   * of npx. Also the created plugin later in the test can be made to use this
   * Nexus instead of the pubished one.
   */
  localNexus: null | {
    path: string
    createAppWithThis: boolean
    createPluginWithThis: boolean
    pluginLinksToThis: boolean
  }
}

/**
 * The path at which to spawn node processes
 */
const NODE_PATH = os.platform() === 'win32' ? 'node.exe' : 'node'

export function createE2EContext(config: Config) {
  Logger.log.settings({ filter: { level: 'trace' } })
  process.env.LOG_LEVEL = 'trace'

  if (config.serverPort) {
    process.env.PORT = String(config.serverPort)
  }

  const localNexusBinPath = config.localNexus
    ? Path.join(config.localNexus.path, 'dist', 'cli', 'main')
    : null
  const projectDir = config?.dir ?? getTmpDir('e2e-app')
  const PROJ_NEXUS_BIN_PATH = Path.join(projectDir, 'node_modules', '.bin', 'nexus')

  log.trace('setup', { projectDir, config })

  FS.dir(projectDir)

  const contextAPI = {
    usingLocalNexus: config.localNexus,
    /**
     * Ignore this if usingLocalNexus is set.
     */
    useNexusVersion: process.env.E2E_NEXUS_VERSION ?? 'latest',
    dir: projectDir,
    config: config,
    getTmpDir: getTmpDir,
    fs: FS.cwd(projectDir),
    client: new GraphQLClient(`http://localhost:${config.serverPort}/graphql`),
    node(args: string[], opts: IPtyForkOptions = {}) {
      return spawn(NODE_PATH, args, { cwd: projectDir, ...opts })
    },
    spawn(binPathAndArgs: string[], opts: IPtyForkOptions = {}) {
      const [binPath, ...args] = binPathAndArgs
      return spawn(binPath, args, { cwd: projectDir, ...opts })
    },
    nexus(args: string[], opts: IPtyForkOptions = {}) {
      return spawn(PROJ_NEXUS_BIN_PATH, args, { cwd: projectDir, ...opts })
    },
    npxNexus(options: { nexusVersion: string }, args: string[]) {
      return spawn('npx', [`nexus@${options.nexusVersion}`, ...args], {
        cwd: projectDir,
        env: {
          ...process.env,
          LOG_LEVEL: 'trace',
        },
      })
    },
    npxNexusCreatePlugin(options: CreatePluginOptions & { nexusVersion: string }) {
      return spawn('npx', [`nexus@${options.nexusVersion}`, 'create', 'plugin'], {
        cwd: projectDir,
        env: {
          ...process.env,
          CREATE_PLUGIN_CHOICE_NAME: options.name,
          LOG_LEVEL: 'trace',
        },
      })
    },
    npxNexusCreateApp(options: CreateAppOptions & { nexusVersion: string }) {
      return spawn('npx', [`nexus@${options.nexusVersion}`], {
        cwd: projectDir,
        env: {
          ...process.env,
          NEXUS_PLUGIN_PRISMA_VERSION: options.prismaPluginVersion ?? 'latest',
          CREATE_APP_CHOICE_PACKAGE_MANAGER_TYPE: options.packageManagerType,
          CREATE_APP_CHOICE_DATABASE_TYPE: options.databaseType,
          LOG_LEVEL: 'trace',
        },
      })
    },
    localNexus: config.localNexus
      ? (args: string[]) => {
          return spawn(NODE_PATH, [localNexusBinPath!, ...args], {
            cwd: projectDir,
            env: {
              ...process.env,
              LOG_LEVEL: 'trace',
            },
          })
        }
      : null,
    localNexusCreateApp: config.localNexus
      ? (options: CreateAppOptions) => {
          return spawn(NODE_PATH, [localNexusBinPath!], {
            cwd: projectDir,
            env: {
              ...process.env,
              NEXUS_PLUGIN_PRISMA_VERSION: options.prismaPluginVersion ?? 'latest',
              CREATE_APP_CHOICE_PACKAGE_MANAGER_TYPE: options.packageManagerType,
              CREATE_APP_CHOICE_DATABASE_TYPE: options.databaseType,
              LOG_LEVEL: 'trace',
            },
          })
        }
      : null,
    localNexusCreatePlugin: config.localNexus
      ? (options: CreatePluginOptions) => {
          return spawn(NODE_PATH, [localNexusBinPath!, 'create', 'plugin'], {
            cwd: projectDir,
            env: {
              ...process.env,
              CREATE_PLUGIN_CHOICE_NAME: options.name,
              LOG_LEVEL: 'trace',
            },
          })
        }
      : null,
  }

  if (config.localNexus) {
    process.env.CREATE_APP_CHOICE_NEXUS_VERSION = `file:${config.localNexus.path}`
  }

  return contextAPI
}

export function spawn(command: string, args: string[], opts: IPtyForkOptions): ConnectableObservable<string> {
  const nodePty = requireNodePty()
  const subject = new Subject<string>()
  // On windows, node-pty needs an absolute path to the executable. `which` is used to find that path.
  const commandPath = which.sync(command)
  const ob = new Observable<string>((sub) => {
    const proc = nodePty.spawn(commandPath, args, {
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
        const error = new Error(`command "${command} ${args.join(' ')}" exited ${exitCode}`)
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

  const multicasted = ob.pipe(multicast(subject)) as ConnectableObservable<string>

  return multicasted
}

interface NodePty {
  spawn: (file: string, args: string[] | string, options: IPtyForkOptions | IWindowsPtyForkOptions) => IPty
}

function requireNodePty(): NodePty {
  try {
    return require('node-pty') as NodePty
  } catch (e) {
    rootLogger.error('Could not require `node-pty`. Please install it as a dev dependency')
    throw e
  }
}
