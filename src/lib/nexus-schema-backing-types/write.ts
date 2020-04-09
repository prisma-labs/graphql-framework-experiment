import * as FS from 'fs-jetpack'
import * as Path from 'path'
import { hardWriteFileSync } from '../fs'
import { rootLogger } from '../nexus-logger'
import { BackingTypes } from './types'

const log = rootLogger.child('backing-types')

export const DEFAULT_RELATIVE_BACKING_TYPES_TYPEGEN_PATH = Path.join(
  'node_modules',
  '@types',
  'typegen-nexus-backing-types',
  'index.d.ts'
)

export async function write(backingTypes: BackingTypes, opts?: { cwd?: string }) {
  const typeNames = Object.keys(backingTypes)
  let output: string = ''

  if (typeNames.length === 0) {
    output = `export type BackingTypes = 'No backing types found. Make sure you have some types exported'\n`
  } else {
    output = `\
 export type BackingTypes =
${typeNames.map((t) => `  | '${t}'`).join('\n')}
`
  }

  output += `\
declare global {
  export interface NexusBackingTypes {
    types: BackingTypes
  }
}
`

  const localFS = FS.cwd(opts?.cwd ?? process.cwd())
  const outputPath = localFS.path(DEFAULT_RELATIVE_BACKING_TYPES_TYPEGEN_PATH)

  log.trace('writing backing-types typegen', { outputPath })

  hardWriteFileSync(outputPath, output)
}
