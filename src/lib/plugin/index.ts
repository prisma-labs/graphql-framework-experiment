import * as NexusSchema from '@nexus/schema'
import { stripIndent } from 'common-tags'
import * as fs from 'fs-jetpack'
import * as Path from 'path'
import prompts, * as Prompts from 'prompts'
import * as Layout from '../../lib/layout'
import {
  CallbackRegistrer,
  DeepPartial,
  MaybePromise,
  SideEffector,
} from '../../lib/utils'
import { TestContextCore } from '../../runtime/testing'
import * as Logger from '../logger'
import { rootLogger } from '../nexus-logger'
import * as PackageManager from '../package-manager'
import { fatal, run, runSync } from '../process'
import { getProjectRoot } from '../project-root'
import * as Chokidar from '../watcher/chokidar'

//todo two loggers here...
const pluginSystemLogger = rootLogger.child('plugin')

type PromptsConstructor = <T extends string = string>(
  questions: Prompts.PromptObject<T> | Array<Prompts.PromptObject<T>>,
  options?: Prompts.Options
) => Promise<Prompts.Answers<T>>

const log = rootLogger.child('plugin-manager')

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
    onBeforeWatcherRestart?: SideEffector
    onAfterWatcherRestart?: SideEffector
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
  // todo schema property name
  nexus?: {
    typegenAutoConfig?: NexusSchema.core.SchemaConfig['typegenAutoConfig']
    plugins?: NexusSchema.core.SchemaConfig['plugins']
  }
}

type RuntimePlugin = () => RuntimeContributions

export type TestingContributions = DeepPartial<TestContextCore>

type TestingPlugin = () => TestingContributions

export type Lens = {
  runtime: CallbackRegistrer<RuntimePlugin>
  workflow: CallbackRegistrer<WorkflowDefiner>
  testing: CallbackRegistrer<TestingPlugin>
  utils: {
    log: Logger.Logger
    runSync: typeof runSync
    run: typeof run
    /**
     * Check out https://github.com/terkelg/prompts for documentation
     */
    prompt: PromptsConstructor
  }
}

type PluginPackage = DriverCreator

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

/**
 * Create a plugin.
 */
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
        log: pluginSystemLogger.child(pluginName),
        run,
        runSync,
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
        log.trace('loading workflow of plugin', { pluginName })
        maybeWorkflowPlugin?.(hooks, {
          layout,
          packageManager: layout.packageManager,
        })
        return hooks
      },
      loadRuntimePlugin() {
        log.trace('loading runtime of plugin', { pluginName })
        return maybeRuntimePlugin?.()
      },
      loadTestingPlugin() {
        log.trace('loading testing of plugin', { pluginName })
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
 * Load all nexus plugins installed into the project
 */
export async function loadAllFromPackageJson(): Promise<Driver[]> {
  const packageJsonPath = Path.join(getProjectRoot(), 'package.json')
  const packageJson: undefined | Record<string, any> = await fs.readAsync(
    packageJsonPath,
    'json'
  )

  if (!packageJson) {
    log.trace(
      'We could not find any package.json file. No plugin will be loaded.',
      { packageJsonPath }
    )
  } else {
    log.trace('Extracting plugins from package.json', {
      path: packageJsonPath,
      content: packageJson,
    })
  }

  return __doLoadAllFromPackageJson(packageJson)
}

/**
 * Load all nexus plugins installed into the project
 * TODO: /!\ This should not be called in production
 */
export function loadAllFromPackageJsonSync(): Driver[] {
  const packageJsonPath = Path.join(getProjectRoot(), 'package.json')
  const packageJson: undefined | Record<string, any> = fs.read(
    packageJsonPath,
    'json'
  )

  if (!packageJson) {
    log.trace(
      'We could not find any package.json file. No plugin will be loaded.',
      { packageJsonPath }
    )
  } else {
    log.trace('Extracting plugins from package.json', {
      path: packageJsonPath,
      content: packageJson,
    })
  }

  return __doLoadAllFromPackageJson(packageJson)
}

/**
 * Logic shared between sync/async variants.
 */
function __doLoadAllFromPackageJson(
  packageJson: undefined | Record<string, any>
): Driver[] {
  if (packageJson === undefined) {
    return []
  }

  const deps: Record<string, string> = packageJson?.dependencies ?? {}

  const depNames = Object.keys(deps)
  if (depNames.length === 0) return []

  const pluginDepNames = depNames.filter(depName =>
    depName.match(/^nexus-plugin-.+/)
  )
  if (pluginDepNames.length === 0) return []

  const instantiatedPlugins: Driver[] = pluginDepNames.map(depName => {
    const pluginName = parsePluginName(depName)! // filter above guarantees

    let SomePlugin: PluginPackage
    try {
      SomePlugin = require(Path.join(process.cwd(), '/node_modules/', depName))

      // The plugin dist code may have been compiled from a TS source and then
      // may have a .default property.
      // @ts-ignore
      if (SomePlugin.default) {
        // @ts-ignore
        SomePlugin = SomePlugin.default
      }
    } catch (error) {
      fatal(
        stripIndent`
        An error occured while importing the plugin ${pluginName}:

        ${error}
      `
      )
    }

    if (typeof SomePlugin !== 'function') {
      // TODO add link to issue tracker extracted from plugin's package.json
      fatal(
        `The plugin "${pluginName}" you are attempting to use did not expose itself on the default export.`
      )
    }

    // Do symbol check to improve feedback upon install failure

    let instantiatedPlugin: Driver
    try {
      instantiatedPlugin = SomePlugin(pluginName)
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
 * Parse a nexus plugin package name to just the plugin name.
 */
export function parsePluginName(packageName: string): null | string {
  const matchResult = packageName.match(/^nexus-plugin-(.+)/)

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
        pluginSystemLogger.trace('load', {
          part: 'workflow',
          plugin: driver.name,
        })
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
        pluginSystemLogger.trace('load', {
          part: 'testing',
          plugin: driver.name,
        })
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
        pluginSystemLogger.trace('load', {
          part: 'runtime',
          plugin: driver.name,
        })
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
