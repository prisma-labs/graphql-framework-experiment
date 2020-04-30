import { Plugin } from '../plugin'
import * as Layout from '../layout'
import { fork } from 'child_process'
import * as Path from 'path'
import { rootLogger } from '../nexus-logger'
import { deserializeError, ErrorObject } from 'serialize-error'
import { saveReflectionStageEnv } from './stage'

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
  | { type: 'error'; data: { serializedError: ErrorObject } }

type ReflectionResultPlugins = { success: false; error: Error } | { success: true; plugins: Plugin[] }
type ReflectionResultArtifactGeneration = { success: false; error: Error } | { success: true }
type ReflectionResult = ReflectionResultPlugins | ReflectionResultArtifactGeneration

/**
 * Run the reflection step of Nexus. Get the used plugins and generate the artifacts optionally.
 */
export function reflect(layout: Layout.Layout, opts: { usedPlugins: true }): Promise<ReflectionResultPlugins>
export function reflect(
  layout: Layout.Layout,
  opts: { artifacts: true }
): Promise<ReflectionResultArtifactGeneration>
export function reflect(
  layout: Layout.Layout,
  opts: { usedPlugins?: true; artifacts?: true }
): Promise<ReflectionResultPlugins | ReflectionResultArtifactGeneration> {
  log.trace('reflection started')
  return new Promise<ReflectionResult>((resolve) => {
    const cp = fork(Path.join(__dirname, 'fork-script.js'), [], {
      cwd: layout.projectRoot,
      stdio: 'pipe',
      env: {
        ...process.env,
        NEXUS_REFLECTION_LAYOUT: JSON.stringify(layout.data),
        ...saveReflectionStageEnv(opts.usedPlugins ? 'plugin' : 'typegen'),
      },
    })

    cp.on('message', (message: Message) => {
      if (message.type === 'success-plugin' && opts.usedPlugins) {
        resolve({ success: true, plugins: message.data.plugins })
      }

      if (message.type === 'success-typegen' && opts.artifacts) {
        resolve({ success: true })
      }

      if (message.type === 'error') {
        resolve({ success: false, error: deserializeError(message.data.serializedError) })
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
