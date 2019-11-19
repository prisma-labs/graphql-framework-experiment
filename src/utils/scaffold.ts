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
  cachedWriteFile(fallbackPath, fallbackContent)

  return fallbackPath
}

export const cachedWriteFile = (
  filePath: string,
  fileContent: string
): void => {
  const alreadyExistingFallbackFileContents = fs.read(filePath)

  if (alreadyExistingFallbackFileContents === undefined) {
    log('writing file %s', filePath)
    fs.write(filePath, fileContent)
  } else if (alreadyExistingFallbackFileContents !== fileContent) {
    log(
      'there is a file already present on disk but its content does not match, replacing old with new %s',
      filePath
    )
    log(alreadyExistingFallbackFileContents)
    log(fileContent)
    fs.write(filePath, fileContent)
  } else {
    log(
      'there is a file already present on disk and its content matches, therefore doing nothing'
    )
  }
}
