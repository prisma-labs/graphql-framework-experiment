import * as fs from 'fs-jetpack'
import { findFile } from './path'
import { log } from './log'

export function findOrScaffold({
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
  const alreadyExistingFallbackFileContents = fs.read(fallbackPath)

  if (alreadyExistingFallbackFileContents === undefined) {
    log('scaffolding fallback file %s', fallbackPath)
    fs.write(fallbackPath, fallbackContent)
  } else if (alreadyExistingFallbackFileContents !== fallbackContent) {
    log(
      'there is prior scaffolding (fallback file) already present on disk but its contents does not match incoming scaffold, replacing old scaffolded file %s',
      fallbackPath
    )
    log(alreadyExistingFallbackFileContents)
    log(fallbackContent)
    fs.write(fallbackPath, fallbackContent)
  } else {
    log(
      'there is prior scaffolding (fallback file) already present on disk and its contents matches the incoming scaffold, therefore doing nothing'
    )
  }

  return fallbackPath
}
