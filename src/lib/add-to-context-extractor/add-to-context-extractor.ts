import * as Path from 'path'
import ts from 'typescript'
import * as Layout from '../../lib/layout'
import { createTSProgram } from '../../lib/tsc'
import { rootLogger } from '../nexus-logger'
import { extractContextTypes, ExtractedContectTypes } from './extractor'
import { writeContextTypeGenFile } from './typegen'

const log = rootLogger.child('add-to-context-extractor')

/**
 * Run the extractor in a work if possible. For example in Node 10 workers are
 * not available by default. If workers are not available then extraction falls
 * back to running in this process, possibly blocking with with intensive CPU work.
 */
export function runAddToContextExtractorAsWorkerIfPossible(
  layoutData: Layout.Layout['data']
) {
  let hasWorkerThreads = areWorkerThreadsAvailable()

  if (hasWorkerThreads) {
    log.trace('Worker threads available')
    runAddToContextExtractorAsWorker(layoutData)
  } else {
    log.trace('Worker threads unavailable. Fallbacking to main process')
    const layout = Layout.createFromData(layoutData)
    const builder = createTSProgram(layout, { withCache: true })
    extractContextTypesToTypeGenFile(builder.getProgram())
  }
}

/**
 * Check whether Worker Threads are available. In Node 10, workers aren't available by default.
 */
function areWorkerThreadsAvailable(): boolean {
  try {
    require('worker_threads')
    return true
  } catch {
    return false
  }
}

/**
 * Run the pure extractor and then write results to a typegen module.
 */
export async function extractContextTypesToTypeGenFile(program: ts.Program) {
  const contextTypes = extractContextTypes(program)
  await writeContextTypeGenFile(contextTypes)
}

/**
 * Run the extractor in a worker.
 */
export function runAddToContextExtractorAsWorker(
  layoutData: Layout.Layout['data']
) {
  // avoid import error in node 10.x
  const { Worker } = require('worker_threads')
  const worker = new Worker(Path.join(__dirname, './worker.js'), {
    workerData: {
      layout: layoutData,
    },
  })

  worker.once('message', (contextTypes: ExtractedContectTypes) => {
    log.trace('finished context type extraction', { contextTypes })

    // Let the Node.js main thread exit, even though the Worker
    // is still running:
    worker.unref()
  })

  worker.on('error', (error: Error) => {
    log.warn(
      'We could not extract your context types from `schema.addToContext`',
      { error }
    )
  })
}
