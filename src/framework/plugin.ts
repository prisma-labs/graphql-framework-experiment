import { NexusConfig } from './nexus'
import * as Layout from './layout'
import * as Chokidar from '../watcher/chokidar'
import { logger } from '../utils/logger'
import { run, pog } from '../utils'
import { Debugger } from 'debug'

// TODO move to utils module
type MaybePromise<T> = void | Promise<void>

export type Controller = {
  layout: Layout.Layout
  log: typeof logger
  run: typeof run
  debug: Debugger
}

export function createController(layout: Layout.Layout): Controller {
  return {
    layout,
    log: logger,
    run: run,
    debug: pog.sub('plugin'),
  }
}

type Definer = (controller: Controller) => Plugin

export function create(definer: Definer): Definer {
  return definer
}

export type Plugin<C extends {} = any> = {
  // TODO We need to enforce the invariant that plugin names are unique or
  // adding randomization into where they are used for naming (e.g. context
  // import alias) or derive unique identifier from plugins off something else
  // like their package name.
  // name: string
  workflow?: WorkflowContributions
  runtime?: {
    /**
     * Run when ... TODO
     */
    onInstall?: () => RuntimeContributions
  }
}

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

export type WorkflowContributions = {
  onBuildStart?: () => MaybePromise<void>
  onDevStart?: () => MaybePromise<void>
  onDevFileWatcherEvent?: Chokidar.FileWatcherEventCallback
  watchFilePatterns?: string[]
  ignoreFilePatterns?: string[]
  onGenerateStart?: () => MaybePromise<void>
  onCreateAfterScaffold?: (socket: Socket) => MaybePromise<void>
  onCreateAfterDepInstall?: (socket: Socket) => MaybePromise<void>
}

/**
 * Cutely named, this is just the handle that plugins get access to aid
 * integration. Includes utilities for logging, and access to project layout data.
 */
export type Socket = {
  // TODO something richer
  log: typeof console.log
  layout: Layout.Layout
}
