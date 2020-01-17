import { stripIndent } from 'common-tags'
import { Debugger } from 'debug'
import * as fs from 'fs-jetpack'
import prompts from 'prompts'
import { fatal, pog, run, runSync } from '../utils'
import { logger } from '../utils/logger'
import * as PackageManager from '../utils/package-manager'
import * as Chokidar from '../watcher/chokidar'
import * as Layout from './layout'
import { NexusConfig } from './nexus'
import { TestContext } from './testing'

const log = pog.sub('plugin-manager')

// TODO move to utils module
type MaybePromise<T = void> = T | Promise<T>
type CallbackRegistrer<F> = (f: F) => void
type SideEffector = () => MaybePromise

export type OnAfterBaseSetupLens = {
  database: 'SQLite' | 'MySQL' | 'PostgreSQL' | undefined
  connectionURI: string | undefined
}

export type DbMigratePlanContext = {
  migrationName: string | undefined
}

export type DbMigrateApplyContext = {
  force: boolean | undefined
}

export type DbUiContext = {
  port?: number
}

export type WorkflowHooks = {
  create: {
    onAfterBaseSetup?: (lens: OnAfterBaseSetupLens) => MaybePromise
  }
  dev: {
    onStart?: SideEffector
    onFileWatcherEvent?: Chokidar.FileWatcherEventCallback
    addToWatcherSettings: {
      /**
       * Set additional files to be watched for the app and plugin listeners
       */
      watchFilePatterns?: string[]
      listeners?: {
        /**
         * Define the watcher settings for the app listener
         */
        app?: {
          /**
           * Set files patterns that should not trigger a server restart by the app
           */
          ignoreFilePatterns?: string[]
        }
        /**
         * Define the watcher settings for your plugin listener
         */
        plugin?: {
          /**
           * Set file patterns that should trigger `dev.onFileWatcherEvent`
           * When set without `plugin.ignoreFilePatterns`, `dev.onFileWatcherEvent` will only react to changes made to the files which matches the `plugin.allowFilePatterns` patterns
           * When set with `plugin.ignoreFilePatterns`, `dev.onFileWatcherEvent` will only react to changes made to the files which matches the `plugin.allowFilePatterns` patterns, minus the files which matches `plugin.ignoreFilePatterns`
           */
          allowFilePatterns?: string[]
          /**
           * Set file patterns that should not trigger `dev.onFileWatcherEvent`
           * When set without `plugin.allowFilePatterns`, `dev.onFileWatcherEvent` will react to changes made to all files watched except the files which matches the `plugin.ignoreFilePatterns` patterns
           * When set with `plugin.allowFilePatterns`, , `dev.onFileWatcherEvent` will react to changes made to all files matched by `plugin.allowFilesPatterns` except the files which matches the `plugin.ignoreFilePatterns` patterns
           */
          ignoreFilePatterns?: string[]
        }
      }
    }
  }
  generate: {
    onStart?: SideEffector
  }
  build: {
    onStart?: SideEffector
  }
  db?: {
    init: {
      onStart: SideEffector
    }
    migrate: {
      plan: {
        onStart: (ctx: DbMigratePlanContext) => void
      }
      apply: {
        onStart: (ctx: DbMigrateApplyContext) => void
      }
      rollback: {
        onStart: SideEffector
      }
    }
    ui: {
      onStart: (ctx: DbUiContext) => void
    }
  }
}

export type WorkflowDefiner = (
  hooks: WorkflowHooks,
  workflowContext: {
    layout: Layout.Layout
    packageManager: PackageManager.PackageManager
  }
) => void

/**
 * The possible things that plugins can contribute toward at runtime. Everything
 * is optional.
 */
export type RuntimeContributions<C extends {} = any> = {
  context?: {
    typeGen: {
      fields: Record<string, string>
      imports?: Array<{
        as: string
        from: string
      }>
    }
    create: (req: Express.Request) => C
  }
  nexus?: {
    plugins: NexusConfig['plugins']
  }
}

type RuntimePlugin = () => RuntimeContributions

type DeepPartial<T extends Record<string, any>> = {
  [P in keyof T]?: T[P] extends Record<string, any> ? DeepPartial<T[P]> : T[P]
} & { [x: string]: any }

export type TestingContributions = DeepPartial<TestContext>

type TestingPlugin = () => TestingContributions

export type Lens = {
  runtime: CallbackRegistrer<RuntimePlugin>
  workflow: CallbackRegistrer<WorkflowDefiner>
  testing: CallbackRegistrer<TestingPlugin>
  utils: {
    log: typeof logger
    runSync: typeof runSync
    run: typeof run
    debug: Debugger
    /**
     * Check out https://github.com/terkelg/prompts for documentation
     */
    prompt: typeof prompts
  }
}

type PluginPackage = {
  create: DriverCreator
}

type Definer = (lens: Lens) => void

export type DriverCreator = (pluginName: string) => Driver

export type Driver = {
  name: string
  extendsWorkflow: boolean
  extendsRuntime: boolean
  extendsTesting: boolean
  loadWorkflowPlugin: (layout: Layout.Layout) => WorkflowHooks
  loadRuntimePlugin: () => undefined | RuntimeContributions
  loadTestingPlugin: () => undefined | TestingContributions
}

export function create(definer: Definer): DriverCreator {
  let maybeWorkflowPlugin: undefined | WorkflowDefiner
  let maybeRuntimePlugin: undefined | RuntimePlugin
  let maybeTestingPlugin: undefined | TestingPlugin

  return pluginName => {
    definer({
      runtime(f) {
        maybeRuntimePlugin = f
      },
      workflow(f) {
        maybeWorkflowPlugin = f
      },
      testing(f) {
        maybeTestingPlugin = f
      },
      utils: {
        log: logger,
        run,
        runSync,
        debug: pog.sub(`plugin:${pluginName}`),
        prompt: prompts,
      },
    })

    return {
      name: pluginName,
      extendsWorkflow: maybeWorkflowPlugin !== undefined,
      extendsRuntime: maybeRuntimePlugin !== undefined,
      extendsTesting: maybeTestingPlugin !== undefined,
      loadWorkflowPlugin(layout) {
        const hooks: WorkflowHooks = {
          create: {},
          dev: {
            addToWatcherSettings: {},
          },
          build: {},
          generate: {},
        }
        log('loading workflow of plugin %s', pluginName)
        maybeWorkflowPlugin?.(hooks, {
          layout,
          packageManager: layout.packageManager,
        })
        return hooks
      },
      loadRuntimePlugin() {
        log('loading runtime of plugin %s', pluginName)
        return maybeRuntimePlugin?.()
      },
      loadTestingPlugin() {
        log('loading testing of plugin %s', pluginName)
        return maybeTestingPlugin?.()
      },
    }
  }
}

// export type Plugin<C extends {} = any> = {
//   // TODO We need to enforce the invariant that plugin names are unique or
//   // adding randomization into where they are used for naming (e.g. context
//   // import alias) or derive unique identifier from plugins off something else
//   // like their package name.
//   // name: string
//   workflow?: WorkflowContributions
//   runtime?: {
//     /**
//      * Run when ... TODO
//      */
//     onInstall?: () => RuntimeContributions
//   }
// }

// export type WorkflowContributions = {
//   onBuildStart?: () => MaybePromise<void>
//   onDevStart?: () => MaybePromise<void>
//   onDevFileWatcherEvent?: Chokidar.FileWatcherEventCallback
//   watchFilePatterns?: string[]
//   ignoreFilePatterns?: string[]
//   onGenerateStart?: () => MaybePromise<void>
//   onCreateAfterScaffold?: (socket: Socket) => MaybePromise<void>
//   onCreateAfterDepInstall?: (socket: Socket) => MaybePromise<void>
// }

/**
 * Cutely named, this is just the handle that plugins get access to aid
 * integration. Includes utilities for logging, and access to project layout data.
 */
// export type Socket = {
//   // TODO something richer
//   log: typeof console.log
//   layout: Layout.Layout
// }

/**
 * Load all graphql-santa plugins installed into the project
 */
export async function loadAllFromPackageJson(): Promise<Driver[]> {
  const packageJson: undefined | Record<string, any> = await fs.readAsync(
    'package.json',
    'json'
  )
  return __doLoadAllFromPackageJson(packageJson)
}

/**
 * Load all graphql-santa plugins installed into the project
 */
export function loadAllFromPackageJsonSync(): Driver[] {
  const packageJson: undefined | Record<string, any> = fs.read(
    'package.json',
    'json'
  )
  return __doLoadAllFromPackageJson(packageJson)
}

/**
 * Logic shared between sync/async variants.
 */
function __doLoadAllFromPackageJson(
  packageJson: undefined | Record<string, any>
): Driver[] {
  if (packageJson === undefined) return []

  const deps: Record<string, string> = packageJson?.dependencies ?? {}

  const depNames = Object.keys(deps)
  if (depNames.length === 0) return []

  const pluginDepNames = depNames.filter(depName =>
    depName.match(/^graphql-santa-plugin-.+/)
  )
  if (pluginDepNames.length === 0) return []

  const instantiatedPlugins: Driver[] = pluginDepNames.map(depName => {
    const pluginName = parsePluginName(depName)! // filter above guarantees

    let SomePlugin: PluginPackage
    try {
      SomePlugin = require(depName)
    } catch (error) {
      fatal(
        stripIndent`
        An error occured while importing the plugin ${pluginName}:

        ${error}
      `
      )
    }

    if (typeof SomePlugin.create !== 'function') {
      // TODO add link to issue tracker extracted from plugin's package.json
      fatal(
        `The plugin "${pluginName}" you are attempting to use does not export a "create" value.`
      )
    }

    // Do symbol check to improve feedback upon install failure

    let instantiatedPlugin: Driver
    try {
      instantiatedPlugin = SomePlugin.create(pluginName)
    } catch (error) {
      fatal(
        stripIndent`
          An error occured while loading the plugin "${pluginName}":

          ${error}
        `
      )
    }
    return instantiatedPlugin
  })

  return instantiatedPlugins
}

/**
 * Parse a graphql-santa plugin package name to just the plugin name.
 */
export function parsePluginName(packageName: string): null | string {
  const matchResult = packageName.match(/^graphql-santa-plugin-(.+)/)

  if (matchResult === null) return null

  const pluginName = matchResult[1]

  return pluginName
}

/**
 * Load all workflow plugins that are installed into the project.
 */
export async function loadAllWorkflowPluginsFromPackageJson(
  layout: Layout.Layout
): Promise<{ name: string; hooks: WorkflowHooks }[]> {
  const plugins = await loadAllFromPackageJson()
  const workflowHooks = plugins
    .filter(driver => driver.extendsWorkflow)
    .map(driver => {
      let workflowComponent: WorkflowHooks
      try {
        workflowComponent = driver.loadWorkflowPlugin(layout)
      } catch (error) {
        fatal(
          stripIndent`
          Error while trying to load the workflow component of plugin "${driver.name}":
          
          ${error}
        `
        )
      }
      return { name: driver.name, hooks: workflowComponent }
    })

  return workflowHooks
}

/**
 * Load all runtime plugins that are installed into the project.
 */
export async function loadAllRuntimePluginsFromPackageJson(): Promise<
  RuntimeContributions[]
> {
  const plugins = await loadAllFromPackageJson()
  return __doLoadAllRuntimePluginsFromPackageJson(plugins)
}

/**
 * Load all runtime plugins that are installed into the project.
 */
export function loadAllRuntimePluginsFromPackageJsonSync(): RuntimeContributions[] {
  const plugins = loadAllFromPackageJsonSync()
  return __doLoadAllRuntimePluginsFromPackageJson(plugins)
}

export async function loadAllTestingPluginsFromPackageJson(): Promise<
  TestingContributions[]
> {
  const plugins = await loadAllFromPackageJson()

  const testingPlugins = plugins
    .filter(driver => driver.extendsTesting)
    .map(driver => {
      let testingContributions: TestingContributions
      try {
        testingContributions = driver.loadTestingPlugin()! // guaranteed by above filter
      } catch (error) {
        fatal(
          stripIndent`
          Error while trying to load the testing component of plugin "${driver.name}":
          
          ${error}
        `
        )
      }
      return testingContributions
    })

  return testingPlugins
}

/**
 * Logic shared between sync/async variants.
 */
function __doLoadAllRuntimePluginsFromPackageJson(
  plugins: Driver[]
): RuntimeContributions[] {
  const runtimePlugins = plugins
    .filter(driver => driver.extendsRuntime)
    .map(driver => {
      let runtimeContributions: RuntimeContributions
      try {
        log('loading runtime of plugin %s', driver.name)
        runtimeContributions = driver.loadRuntimePlugin()! // guaranteed by above filter
      } catch (error) {
        fatal(
          stripIndent`
          Error while trying to load the runtime component of plugin "${driver.name}":
          
          ${error}
        `
        )
      }
      return runtimeContributions
    })

  return runtimePlugins
}
