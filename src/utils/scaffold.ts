import dedent from 'dedent'
import * as fs from 'fs-jetpack'
import { findFile } from './path'

export function findOrScaffold({
  fileNames,
  fallbackPath,
  fallbackContent,
}: {
  fileNames: string[]
  fallbackPath: string
  fallbackContent: string
}) {
  const optionalFile = findFile(fileNames)

  if (optionalFile) {
    return optionalFile
  }

  fs.write(fallbackPath, dedent(fallbackContent))

  return fallbackPath
}
