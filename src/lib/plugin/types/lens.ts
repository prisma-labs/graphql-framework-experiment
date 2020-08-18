import * as Logger from '@nexus/logger'
import * as NexusSchema from '@nexus/schema'
import * as Prompts from 'prompts'
import * as Scalars from '../../scalars'
import * as Testing from '../../../testing/testing'
import * as Layout from '../../layout'
import * as PackageManager from '../../package-manager'
import * as Process from '../../process'
import * as Utils from '../../utils'
import * as Watcher from '../../watcher'
import * as Chokidar from '../../watcher/chokidar'

type PromptsConstructor = <T extends string = string>(
  questions: Prompts.PromptObject<T> | Array<Prompts.PromptObject<T>>,
  options?: Prompts.Options
) => Promise<Prompts.Answers<T>>

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

export type WorktimeHooks = {
  create: {
    onAfterBaseSetup?: (lens: OnAfterBaseSetupLens) => Utils.MaybePromise
  }
  dev: {
    onStart?: Utils.SideEffector
    onBeforeWatcherRestart?: Utils.SideEffector
    //prettier-ignore
    onBeforeWatcherStartOrRestart?: (change: Watcher.ChangeEvent) => Utils.MaybePromise<void | Watcher.RunnerOptions>
    onAfterWatcherRestart?: Utils.SideEffector
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
    onStart?: Utils.SideEffector
  }
  build: {
    onStart?: Utils.SideEffector
  }
  db?: {
    init: {
      onStart: Utils.SideEffector
    }
    migrate: {
      plan: {
        onStart: (ctx: DbMigratePlanContext) => void
      }
      apply: {
        onStart: (ctx: DbMigrateApplyContext) => void
      }
      rollback: {
        onStart: Utils.SideEffector
      }
    }
    ui: {
      onStart: (ctx: DbUiContext) => void
    }
  }
}

export type WorkflowDefiner = (
  hooks: WorktimeHooks,
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
    create: (req: Express.Request) => Utils.MaybePromise<C>
  }
  schema?: {
    typegenAutoConfig?: NexusSchema.core.SchemaConfig['typegenAutoConfig']
    plugins?: NexusSchema.core.SchemaConfig['plugins']
  }
}

export type TesttimeContributions = Utils.DeepPartial<Testing.TestContextCore, true>

export type Lens = {
  log: Logger.Logger
  runSync: typeof Process.runSync
  run: typeof Process.run
  /**
   * Check out https://github.com/terkelg/prompts for documentation
   */
  prompt: PromptsConstructor
}

export interface RuntimeLens extends Lens {
  shouldGenerateArtifacts: boolean // TODO: Should probably become isReflectionPhase
  scalars: Scalars.Scalars
}

export interface TesttimeLens extends Lens {}

export interface WorktimeLens extends Lens {
  hooks: WorktimeHooks
  layout: Layout.Layout
  packageManager: PackageManager.PackageManager
}
