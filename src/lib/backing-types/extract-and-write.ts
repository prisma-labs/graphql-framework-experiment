import { extractWithTS } from './extract'
import { write } from './write'
import { Layout } from '../layout'

export async function extractAndWrite(
  layout: Layout,
  filePattern?: string,
  opts?: { extractCwd?: string; writeCwd?: string }
) {
  const backingTypes = await extractWithTS(layout, filePattern)

  await write(backingTypes, { cwd: opts?.writeCwd })

  return backingTypes
}
