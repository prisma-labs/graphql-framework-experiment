const ts = require('typescript')
const { parentPort, workerData } = require('worker_threads')
const {
  NEXUS_DEFAULT_RUNTIME_CONTEXT_TYPEGEN_PATH,
} = require('../framework/schema/config')
const { remove, write } = require('fs-jetpack')
const { dirname } = require('path')
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
remove(dirname(NEXUS_DEFAULT_RUNTIME_CONTEXT_TYPEGEN_PATH))
write(NEXUS_DEFAULT_RUNTIME_CONTEXT_TYPEGEN_PATH, contextTypesFileContent)

parentPort.postMessage(contextTypes)
