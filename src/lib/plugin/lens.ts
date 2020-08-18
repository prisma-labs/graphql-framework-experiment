import * as Lo from 'lodash'
import prompts from 'prompts'
import * as Scalars from '../scalars'
import * as Layout from '../layout'
import { rootLogger } from '../nexus-logger'
import * as Process from '../process'
import { isReflectionStage } from '../reflection/stage'
import { Lens, RuntimeLens, WorktimeLens } from './types'

const log = rootLogger.child('plugin')

export function createBaseLens(pluginName: string): Lens {
  return {
    log: log.child(Lo.camelCase(pluginName)),
    run: Process.run,
    runSync: Process.runSync,
    prompt: prompts,
  }
}

export function createRuntimeLens(pluginName: string, scalars: Scalars.Scalars): RuntimeLens {
  return {
    ...createBaseLens(pluginName),
    shouldGenerateArtifacts: isReflectionStage('typegen'),
    scalars,
  }
}

export function createWorktimeLens(layout: Layout.Layout, pluginName: string): WorktimeLens {
  return {
    ...createBaseLens(pluginName),
    layout: layout,
    packageManager: layout.packageManager,
    hooks: {
      create: {},
      dev: {
        addToWatcherSettings: {},
      },
      build: {},
      generate: {},
    },
  }
}
