import { extract } from './extract'
import { find } from './find'
import { write } from './write'

export async function extractAndWrite(
  filePattern?: string,
  opts: { cwd: string } = { cwd: process.cwd() }
) {
  const backingTypesFiles = await find(filePattern, opts)
  const backingTypes = await extract(backingTypesFiles)

  await write(backingTypes, opts)

  return backingTypes
}
