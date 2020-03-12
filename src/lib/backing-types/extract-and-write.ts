import { extract } from './extract'
import { find } from './find'
import { write } from './write'

export async function extractAndWrite(filePattern?: string) {
  const backingTypesFiles = await find(filePattern)
  const backingTypes = await extract(backingTypesFiles)

  await write(backingTypes)

  return backingTypes
}
