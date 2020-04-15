import * as Path from 'path'
import ts from 'typescript'
import * as Layout from '../../lib/layout'
import { createTSProgram } from '../../lib/tsc'
import { rootLogger } from '../nexus-logger'
import { areWorkerThreadsAvailable } from '../utils'
import { extractContextTypes, ExtractedContextTypes } from './extractor'
import { writeContextTypeGenFile } from './typegen'

const log = rootLogger.child('add-to-context-extractor')

/**
 * Run the extractor in a work if possible. For example in Node 10 workers are
 * not available by default. If workers are not available then extraction falls
 * back to running in this process, possibly blocking with with intensive CPU work.
 */
export function runAddToContextExtractorAsWorkerIfPossible(
  layoutData: Layout.Layout['data']
): Promise<ExtractedContextTypes> {
  log.trace('starting context type extraction')
  let hasWorkerThreads = areWorkerThreadsAvailable()

  if (hasWorkerThreads) {
    log.trace('Worker threads available')
    return runAddToContextExtractorAsWorker(layoutData)
  } else {
    log.trace('Worker threads unavailable. Fallbacking to main process')
    const layout = Layout.createFromData(layoutData)
    const builder = createTSProgram(layout, { withCache: true })
    return extractContextTypesToTypeGenFile(builder.getProgram())
  }
}

/**
 * Run the pure extractor and then write results to a typegen module.
 */
export async function extractContextTypesToTypeGenFile(program: ts.Program) {
  const contextTypes = extractContextTypes(program)
  await writeContextTypeGenFile(contextTypes)
  return contextTypes
}

/**
 * Run the extractor in a worker.
 */
export function runAddToContextExtractorAsWorker(layoutData: Layout.Layout['data']) {
  return new Promise<ExtractedContextTypes>((resolve, reject) => {
    // avoid import error in node 10.x
    const { Worker } = require('worker_threads')
    const worker = new Worker(Path.join(__dirname, './worker.js'), {
      workerData: {
        layout: layoutData,
      },
    })

    worker.once('message', (contextTypes: ExtractedContextTypes) => {
      log.trace('finished context type extraction', { contextTypes })

      // Let the Node.js main thread exit, even though the Worker
      // is still running:
      worker.unref()
      resolve(contextTypes)
    })

    worker.on('error', (error: Error) => {
      log.warn('We could not extract your context types from `schema.addToContext`', { error })
      reject(error)
    })
  })
}
