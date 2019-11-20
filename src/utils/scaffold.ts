import * as fs from 'fs-jetpack'
import { findFile, writeCachedFile } from './path'
import { pog } from './pog'

export async function findOrScaffold({
  fileNames,
  fallbackPath,
  fallbackContent,
}: {
  fileNames: string[]
  fallbackPath: string
  fallbackContent: string
}) {
  pog('find or scaffold %s', fileNames)
  const optionalFile = findFile(fileNames)

  if (optionalFile) {
    pog('found %s', optionalFile)
    if (fs.exists(fallbackPath)) {
      pog(
        'there is prior scaffolding (fallback file) already present on disk somehow, removing it now: %s',
        fallbackPath
      )
      fs.remove(fallbackPath)
    }
    return optionalFile
  }

  pog('did not find')
  await writeCachedFile(fallbackPath, fallbackContent)

  return fallbackPath
}
