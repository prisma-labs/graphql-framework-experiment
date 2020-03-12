import * as fs from 'fs-jetpack'
import { hardWriteFileSync } from '../../utils'
import { BackingTypes } from './extract'

export async function writeBackingTypes(backingTypes: BackingTypes) {
  let output: string = ''
  const typeNames = Object.keys(backingTypes)

  if (typeNames.length === 0) {
    output = `export type BackingTypes = 'No backing types found. Make sure you have some types exported'\n`
  } else {
    output = `\
 export type BackingTypes =
${typeNames.map(t => `  | '${t}'`).join('\n')}
`
  }

  output += `\
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
    output
  )
}
