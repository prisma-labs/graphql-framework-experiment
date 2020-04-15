import * as Plugin from '../plugin'
import { MaybePromise } from '../utils'
import { ChangeType } from './chokidar'

export type Event =
  | { type: 'server_listening' }
  | { type: 'restart'; file: string; reason: ChangeType | 'plugin' }
  | { type: 'runner_stdio'; stdio: 'stderr' | 'stdout'; data: string }

export interface Options {
  sourceRoot: string
  cwd: string
  entrypointScript: string
  plugins: Plugin.WorktimeHooks[]
  /**
   * Host and/or port on which the debugger should listen to
   */
  inspectBrk?: string
  events?: (e: Event) => MaybePromise<void>
}
