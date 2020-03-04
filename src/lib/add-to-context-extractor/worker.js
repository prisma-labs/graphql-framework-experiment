const ts = require('typescript')
const { parentPort, workerData } = require('worker_threads')
const { extractContextTypes } = require('./')
const { readTsConfig, hardWriteFileSync } = require('../../utils')

const tsConfig = readTsConfig(workerData.layout)

const program = ts.createIncrementalProgram({
  rootNames: tsConfig.fileNames,
  options: {
    incremental: true,
    tsBuildInfoFile: './node_modules/.nexus/cache.tsbuildinfo',
    ...tsConfig.options,
  },
})

const contextTypes = extractContextTypes(program)

const addToContextInterfaces = contextTypes
  .map(result => ` interface Context ${result}`)
  .join('\n\n')

const contextTypesFileContent = `
import app from 'nexus-future'

declare global {
  export interface NexusContext extends Context {}
}

${
  addToContextInterfaces.length > 0
    ? addToContextInterfaces
    : `interface Context {}`
}
`

hardWriteFileSync(workerData.output, contextTypesFileContent)

parentPort.postMessage(contextTypes)
