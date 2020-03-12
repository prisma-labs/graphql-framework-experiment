import * as fs from 'fs-jetpack'
import { hardWriteFileSync } from '../../utils'
import { BackingTypes } from './types'

export async function write(
  backingTypes: BackingTypes,
  opts: { cwd: string } = { cwd: process.cwd() }
) {
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

  const localFS = fs.cwd(opts.cwd)

  hardWriteFileSync(
    localFS.path(
      'node_modules',
      '@types',
      'typegen-nexus-backing-types',
      'index.d.ts'
    ),
    output
  )
}
