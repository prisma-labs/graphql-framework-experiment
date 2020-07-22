import { fork } from 'child_process'
import * as Path from 'path'
import * as App from '../../runtime/app'
import { createDevAppRunner } from '../../runtime/start'
import * as Layout from '../layout'
import { rootLogger } from '../nexus-logger'
import { Plugin } from '../plugin'
import { deserializeError, SerializedError } from '../utils'
import { getReflectionStageEnv, setReflectionStage, unsetReflectionStage } from './stage'

const log = rootLogger.child('reflection')

export type Message =
  | {
      type: 'success-plugin'
      data: {
        plugins: Plugin[]
      }
    }
  | {
      type: 'success-typegen'
    }
  | { type: 'runtime-error' | 'ts-error'; data: { serializedError: SerializedError } }

type ReflectionResultPlugins = { success: false; error: Error } | { success: true; plugins: Plugin[] }
type ReflectionResultArtifactGeneration =
  | { success: false; error: Error; type: 'runtime-error' | 'ts-error' }
  | { success: true }
type ReflectionResult = ReflectionResultPlugins | ReflectionResultArtifactGeneration

/**
 * Run the reflection step of Nexus. Get the used plugins and generate the artifacts optionally.
 */
export function reflect(
  layout: Layout.Layout,
  opts: { usedPlugins: true; onMainThread: true }
): Promise<ReflectionResultPlugins>
export function reflect(
  layout: Layout.Layout,
  opts: { artifacts: true }
): Promise<ReflectionResultArtifactGeneration>
export async function reflect(
  layout: Layout.Layout,
  opts: { usedPlugins?: true; artifacts?: true; onMainThread?: boolean }
): Promise<ReflectionResultPlugins | ReflectionResultArtifactGeneration> {
  log.trace('reflection started')
  if (opts.artifacts) {
    return runTypegenReflectionAsSubProcess(layout)
  }

  if (opts.usedPlugins === true && opts.onMainThread === false) {
    throw new Error('Not implemented. Reflection on plugins needs to be done on the main process for now.')
  }

  return runPluginsReflectionOnMainThread(layout)
}

/**
 * Hack: Plugins should ideally be discovered in a sub-process.
 * This is temporary until https://github.com/graphql-nexus/nexus/issues/818 is fixed
 */
export async function runPluginsReflectionOnMainThread(
  layout: Layout.Layout
): Promise<ReflectionResultPlugins> {
  const app = require('../../').default as App.PrivateApp
  const appRunner = createDevAppRunner(layout, app, {
    catchUnhandledErrors: false,
  })

  setReflectionStage('plugin')

  try {
    await appRunner.start()

    unsetReflectionStage()

    return { success: true, plugins: app.private.state.plugins }
  } catch (error) {
    return { success: false, error }
  }
}

export function runTypegenReflectionAsSubProcess(layout: Layout.Layout) {
  return new Promise<ReflectionResult>((resolve) => {
    const cp = fork(Path.join(__dirname, 'fork-script.js'), [], {
      cwd: layout.projectRoot,
      stdio: process.env.DEBUG ? 'inherit' : 'pipe',
      env: {
        ...process.env,
        NEXUS_REFLECTION_LAYOUT: JSON.stringify(layout.data),
        ...getReflectionStageEnv('typegen'),
      },
    })

    cp.on('message', (message: Message) => {
      if (message.type === 'success-typegen') {
        resolve({ success: true })
      }

      if (message.type === 'ts-error') {
        resolve({ success: false, type: 'ts-error', error: deserializeError(message.data.serializedError) })
      }

      if (message.type === 'runtime-error') {
        resolve({
          success: false,
          type: 'runtime-error',
          error: deserializeError(message.data.serializedError),
        })
      }
    })

    cp.on('error', (err) => {
      log.trace('error', { err })
      resolve({ success: false, error: err })
    })

    cp.stderr?.on('data', (err) => {
      log.trace('error', { err })
      resolve({ success: false, error: new Error(err) })
    })

    cp.on('exit', (code) => {
      if (code !== 0) {
        log.trace('failed with exit code !== 0', { code })
        resolve({
          success: false,
          error: new Error(`
        Runner failed with exit code "${code}".
      `),
        })
      }
    })
  })
}
