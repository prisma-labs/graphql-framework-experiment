import * as fs from 'fs-jetpack'
import { log } from './logger'
import { findFile, writeCachedFile } from './path'

// todo unused... delete?
export async function findOrScaffold({
  fileNames,
  fallbackPath,
  fallbackContent,
}: {
  fileNames: string[]
  fallbackPath: string
  fallbackContent: string
}) {
  log.trace('find or scaffold', { fileNames })
  const optionalFile = findFile(fileNames)

  if (optionalFile) {
    log.trace('found', { optionalFile })
    if (fs.exists(fallbackPath)) {
      log.trace(
        'there is prior scaffolding (fallback file) already present on disk somehow, removing it now',
        { fallbackPath }
      )
      fs.remove(fallbackPath)
    }
    return optionalFile
  }

  log.trace('did not find')
  await writeCachedFile(fallbackPath, fallbackContent)

  return fallbackPath
}
