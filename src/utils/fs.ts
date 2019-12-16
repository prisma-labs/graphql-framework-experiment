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
