import * as Path from 'path'
import ts from 'typescript'
import { Layout } from '../../framework/layout'
import { readTsConfig } from '../../utils'
import { rootLogger } from '../../utils/logger'
import { extractContextTypes, ExtractedContectTypes } from './extractor'
import { writeContextTypeGenFile } from './typegen'

const log = rootLogger.child('add-to-context-extractor')

export async function extractContextTypesToTypeGenFile(program: ts.Program) {
  const contextTypes = extractContextTypes(program)
  await writeContextTypeGenFile(contextTypes)
}

export function runAddToContextExtractorAsWorkerIfPossible(layout: Layout) {
  let hasWorkerThreads = false
  try {
    require('worker_threads')
  } catch {
    // stays false
  } finally {
    if (hasWorkerThreads) {
      runAddToContextExtractorAsWorker(layout)
    } else {
      const tsConfig = readTsConfig(layout)
      const builder = ts.createIncrementalProgram({
        rootNames: tsConfig.fileNames,
        options: {
          incremental: true,
          tsBuildInfoFile: './node_modules/.nexus/cache.tsbuildinfo',
          ...tsConfig.options,
        },
      })
      extractContextTypesToTypeGenFile(builder.getProgram())
    }
  }
}

/**
 * Run the extractor in a worker.
 */
export function runAddToContextExtractorAsWorker(layout: Layout) {
  // avoid import error in node 10.x
  const { Worker } = require('worker_threads')
  const worker = new Worker(Path.join(__dirname, './worker.js'), {
    workerData: {
      layout: layout.data,
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
