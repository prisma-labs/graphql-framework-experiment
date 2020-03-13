import { extract } from './extract'
import { find } from './find'
import { write } from './write'

export async function extractAndWrite(
  filePattern?: string,
  opts?: { extractCwd?: string; writeCwd?: string }
) {
  const backingTypesFiles = await find(filePattern, { cwd: opts?.extractCwd })
  const backingTypes = await extract(backingTypesFiles)

  await write(backingTypes, { cwd: opts?.writeCwd })

  return backingTypes
}
