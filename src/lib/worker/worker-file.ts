/**
 * This file is executed in a NodeJS Worker Thread
 */
import * as Layout from '../layout'
import * as Build from '../build'
import { workerData } from 'worker_threads'
import { createTSProgram } from '../tsc'
import { extractContextTypesToTypeGenFile } from '../add-to-context-extractor/add-to-context-extractor'

const parentData: { layout: Layout.Data; withBuild: boolean } = workerData

const layout = Layout.createFromData(parentData.layout)
const builder = createTSProgram(layout, { withCache: true })

if (parentData.withBuild) {
  try {
    Build.fastProductionBuild(builder, layout)
  } catch {}
}

extractContextTypesToTypeGenFile(builder.getProgram())
