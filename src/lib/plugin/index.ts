import * as NexusSchema from '@nexus/schema'
import * as Prompts from 'prompts'
import * as Layout from '../../lib/layout'
import { DeepPartial, MaybePromise, SideEffector } from '../../lib/utils'
import { TestContextCore } from '../../runtime/testing'
import * as Logger from '../logger'
import * as PackageManager from '../package-manager'
import { run, runSync } from '../process'
import * as Chokidar from '../watcher/chokidar'
export * from './import'
export * from './load'

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
    create: (req: Express.Request) => C
  }
  // todo schema property name
  nexus?: {
    typegenAutoConfig?: NexusSchema.core.SchemaConfig['typegenAutoConfig']
    plugins?: NexusSchema.core.SchemaConfig['plugins']
  }
}

export type TesttimeContributions = DeepPartial<TestContextCore>

export type TestingPlugin = () => TesttimeContributions

export type Lens = {
  log: Logger.Logger
  runSync: typeof runSync
  run: typeof run
  /**
   * Check out https://github.com/terkelg/prompts for documentation
   */
  prompt: PromptsConstructor
}

export interface RuntimeLens extends Lens {}

export interface TesttimeLens extends Lens {}

export interface WorktimeLens extends Lens {
  hooks: WorktimeHooks
  layout: Layout.Layout
  packageManager: PackageManager.PackageManager
}

// prettier-ignore
export type WorktimePlugin = (lens: WorktimeLens) => void
// prettier-ignore
export type RuntimePlugin = (lens: RuntimeLens) => RuntimeContributions
// prettier-ignore
export type TesttimePlugin = (lens: TesttimeLens) => TesttimeContributions
