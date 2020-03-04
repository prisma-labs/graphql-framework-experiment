const ts = require('typescript')
const { parentPort, workerData } = require('worker_threads')
const { extractContextTypesToTypeGenFile } = require('./')
const { readTsConfig } = require('../../utils')

const tsConfig = readTsConfig(workerData.layout)

const builder = ts.createIncrementalProgram({
  rootNames: tsConfig.fileNames,
  options: {
    incremental: true,
    tsBuildInfoFile: './node_modules/.nexus/cache.tsbuildinfo',
    ...tsConfig.options,
  },
})

extractContextTypesToTypeGenFile(builder.getProgram()).then(() => {
  parentPort.postMessage(contextTypes)
})
