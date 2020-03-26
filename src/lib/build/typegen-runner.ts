import Mod from 'module'
import * as tsNode from 'ts-node'
import { getProjectRoot } from '../project-root'

tsNode.register()

const originalRequire = Mod.prototype.require

Mod.prototype.require = Object.assign(function(id: string) {
  console.log(id)
  return originalRequire.apply(Mod.prototype, [id])
}, originalRequire)

const projectRoot = getProjectRoot()

// console.log(process.env.startModule)

// // console.log(resolveFrom(process.cwd(), 'nexus-future'))
// // console.log(process.cwd())
// // console.log(require.resolve('fs-jetpack'))
eval(process.env.startModule!)

// // import { createStartModuleContent } from '../../runtime/start'
// // import { createFromData, Layout } from '../layout'

// // const layout: Layout = createFromData(workerData.layout)

// // eval(
// //   createStartModuleContent({
// //     layout: layout,
// //     internalStage: 'build',
// //   })
// // )
