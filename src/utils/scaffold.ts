import * as fs from 'fs-jetpack'
import { findFile, writeCachedFile } from './path'
import { log } from './log'

export async function findOrScaffold({
  fileNames,
  fallbackPath,
  fallbackContent,
}: {
  fileNames: string[]
  fallbackPath: string
  fallbackContent: string
}) {
  log('find or scaffold %s', fileNames)
  const optionalFile = findFile(fileNames)

  if (optionalFile) {
    log('found %s', optionalFile)
    if (fs.exists(fallbackPath)) {
      log(
        'there is prior scaffolding (fallback file) already present on disk somehow, removing it now: %s',
        fallbackPath
      )
      fs.remove(fallbackPath)
    }
    return optionalFile
  }

  log('did not find')
  await writeCachedFile(fallbackPath, fallbackContent)

  return fallbackPath
}
