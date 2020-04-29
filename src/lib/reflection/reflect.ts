import { Plugin } from '../plugin'
import * as Layout from '../layout'
import { fork } from 'child_process'
import * as Path from 'path'
import { rootLogger } from '../nexus-logger'
import { serializeError, deserializeError, ErrorObject } from 'serialize-error'

const log = rootLogger.child('reflection')

export type Message =
  | {
      type: 'success'
      data: {
        plugins: Plugin[]
      }
    }
  | { type: 'error'; data: { serializedError: ErrorObject } }

type ReflectionResult = { success: false; error: Error } | { success: true; plugins: Plugin[] }

/**
 * Run the reflection step of Nexus. Get the used plugins and generate the artifacts optionally.
 */
export function reflect(
  layout: Layout.Layout,
  opts: { withArtifactGeneration: boolean }
): Promise<ReflectionResult> {
  log.trace('reflection started')
  return new Promise<ReflectionResult>((resolve) => {
    const cp = fork(Path.join(__dirname, 'fork-script.js'), [], {
      cwd: layout.projectRoot,
      stdio: 'pipe',
      env: {
        ...process.env,
        NEXUS_REFLECTION_LAYOUT: JSON.stringify(layout.data),
        NEXUS_SHOULD_GENERATE_ARTIFACTS: opts.withArtifactGeneration === true ? 'true' : undefined,
      },
    })

    cp.on('message', (message: Message) => {
      if (message.type === 'success') {
        log.trace('reflection finished ', { plugins: message.data.plugins })
        resolve({ success: true, plugins: message.data.plugins })
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

export function shouldGenerateArtifacts(): boolean {
  return process.env.NEXUS_SHOULD_GENERATE_ARTIFACTS === 'true'
}
