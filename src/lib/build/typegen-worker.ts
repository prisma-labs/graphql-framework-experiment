require('ts-node').register()
import { workerData } from 'worker_threads'

Object.assign(process.env, {
  NEXUS_SHOULD_AWAIT_TYPEGEN: 'true',
  NEXUS_SHOULD_EXIT_AFTER_GENERATE_ARTIFACTS: 'true',
})

require('fs-jetpack')
console.log('fs-jetpack')

require('nexus-future')
console.log('it worked')

console.log(workerData.startModule)

console.log(require.resolve('nexus-future'))

eval(workerData.startModule)

// import { createStartModuleContent } from '../../runtime/start'
// import { createFromData, Layout } from '../layout'

// const layout: Layout = createFromData(workerData.layout)

// eval(
//   createStartModuleContent({
//     layout: layout,
//     internalStage: 'build',
//   })
// )
