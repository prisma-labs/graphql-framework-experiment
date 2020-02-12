const { parentPort, workerData } = require('worker_threads')
const ts = require('typescript')
const { extractContextTypes, readTsConfig } = require('../utils')

const tsConfig = readTsConfig(workerData.layout)
const program = ts.createIncrementalProgram({
  rootNames: tsConfig.fileNames,
  options: {
    incremental: true,
    tsBuildInfoFile: './node_modules/.nexus/cache.tsbuildinfo',
    ...tsConfig.options,
  },
})

const result = extractContextTypes(program)

parentPort.postMessage(result)
