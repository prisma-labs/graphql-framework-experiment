import { Plugin } from '../plugin'
import * as fs from 'fs-jetpack'
import { pumpkinsDotFolderPath, trimExt, pumpkinsPath } from '../../utils'
import * as path from 'path'

export const createPrismaPlugin: () => Plugin = () => {
  // TODO control generate step before trying to require
  const generatedPhotonPackagePath = fs.path('node_modules/@generated/photon')

  // TODO plugin api for .pumpkins sandboxed fs access
  const generatedContextTypePath = pumpkinsPath('prisma/context.ts')

  fs.write(
    generatedContextTypePath,
    `
      import { Photon } from '${generatedPhotonPackagePath}'
      
      export type Context = {
        photon: Photon
      }
      
      export const createContext: Context = {
        photon: new Photon(),
      }
    `
  )

  return {
    name: 'prisma',
    context: {
      create: _req => {
        return require(trimExt(generatedContextTypePath, '.ts'))
      },
      typeSourcePath: generatedContextTypePath,
      typeExportName: 'Context',
    },
  }
}

// plugin()
//   .onDevStart(() => {
//     // generate prisma
//   })
//   .onBuildStart(() => {
//     // generate prisma
//   })
//   .onInstall(() => {
//   })

// plugin((hooks) => {
//   hooks.onDevStart(() => {})
//   hooks.onBuildStart(() => {})
//   // hooks.onInstall(() => {})

//   return {
//     name: 'prisma',
//     context: {
//       create: _req => {
//         return { photon }
//       },
//       typeSourcePath: generatedContextTypePath,
//       typeExportName: 'Context',
//     },
//   }
// })
