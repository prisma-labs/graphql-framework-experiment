import { extract } from './extract'
import { find } from './find'
import { write } from './write'

export async function generateBackingTypesArtifacts(
  filePattern: string,
  opts?: { extractCwd?: string; writeCwd?: string }
) {
  const backingTypesFiles = await find(filePattern, { cwd: opts?.extractCwd })
  const backingTypes = await extract(backingTypesFiles)

  // Write in background
  await write(backingTypes, { cwd: opts?.writeCwd })

  return backingTypes
}
