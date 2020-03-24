import * as Path from 'path'
import { Layout } from '../layout'
import { ExtractedContectTypes } from '../add-to-context-extractor/extractor'
import { rootLogger } from '../nexus-logger'

const log = rootLogger.child('worker')

export function runWorkerThread(
  layoutData: Layout['data'],
  withBuild: boolean
) {
  // avoid import error in node 10.x
  const { Worker } = require('worker_threads')
  const worker = new Worker(Path.join(__dirname, './worker-file.js'), {
    workerData: {
      layout: layoutData,
      withBuild,
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
