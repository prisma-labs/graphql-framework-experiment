import { workerData } from 'worker_threads'
import * as Layout from '../layout'
import { createTSProgram } from '../tsc'
import { runAddToContextExtractorAsPromise } from './add-to-context-extractor'

const layout = Layout.createFromData(workerData.layoutData)
const builder = createTSProgram(layout, { withCache: true })
runAddToContextExtractorAsPromise(builder.getProgram())
