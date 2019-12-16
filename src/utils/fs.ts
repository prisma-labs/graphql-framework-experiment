import * as fs from 'fs-jetpack'
import * as Path from 'path'

/**
 * Write a file after forcefully removing it, so that VSC will observe the
 * change. It is the case that a plain write, when the file exists, in node,
 * does an update-in-place tactic, probably for optimization, but this isn't
 * enough for proper file change watch detection or something, not sure.
 */
export function removeWrite(filePath: string, fileContent: string): void {
  fs.remove(filePath)
  fs.write(filePath, fileContent)
}

export async function removeWriteAsync(
  filePath: string,
  fileContent: string
): Promise<void> {
  await fs.removeAsync(filePath)
  await fs.writeAsync(filePath, fileContent)
}

/**
 * Search for a file in cwd or in parent directory recursively up to the root directory.
 */
export async function findFileRecurisvelyUpward(
  fileName: string
): Promise<null | string> {
  let path: null | string = null
  let currentDir = process.cwd()

  while (path === null) {
    const checkFilePath = Path.join(currentDir, fileName)

    if (fs.existsAsync(checkFilePath)) {
      path = checkFilePath
      break
    }

    if (currentDir === '/') {
      // we reached root, no where left to go
      break
    }

    currentDir = Path.dirname(currentDir)
  }

  return path
}
