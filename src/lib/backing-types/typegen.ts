import * as fs from 'fs-jetpack'
import { hardWriteFileSync } from '../../utils'
import { BackingTypes } from './extract'

export async function writeBackingTypes(backingTypes: BackingTypes) {
  const final = `
export type BackingTypes =
${Object.keys(backingTypes)
  .map(t => `  | '${t}'`)
  .join('\n')}

declare global {
  export interface NexusBackingTypes {
    types: BackingTypes
  }
}
  `

  hardWriteFileSync(
    fs.path(
      'node_modules',
      '@types',
      'typegen-nexus-backing-types',
      'index.d.ts'
    ),
    final
  )
}
