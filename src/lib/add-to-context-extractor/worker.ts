import ts from 'typescript'
import { workerData } from 'worker_threads'
import { readTsConfig } from '../../utils'
import { extractContextTypesToTypeGenFile } from './add-to-context-extractor'

const tsConfig = readTsConfig(workerData.layout)

const builder = ts.createIncrementalProgram({
  rootNames: tsConfig.fileNames,
  options: {
    incremental: true,
    tsBuildInfoFile: './node_modules/.nexus/cache.tsbuildinfo',
    ...tsConfig.options,
  },
})

extractContextTypesToTypeGenFile(builder.getProgram())
