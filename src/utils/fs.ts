import * as NodeFS from 'fs'
import * as FS from 'fs-jetpack'
import * as OS from 'os'
import * as Path from 'path'

/**
 * Write a file after forcefully removing it, so that VSC will observe the
 * change. It is the case that a plain write, when the file exists, in node,
 * does an update-in-place tactic, probably for optimization, but this isn't
 * enough for proper file change watch detection or something, not sure.
 */
export function removeWrite(filePath: string, fileContent: string): void {
  FS.remove(filePath)
  FS.write(filePath, fileContent)
}

export async function removeWriteAsync(
  filePath: string,
  fileContent: string
): Promise<void> {
  await FS.removeAsync(filePath)
  await FS.writeAsync(filePath, fileContent)
}

/**
 * Search for a file in cwd or in parent directory recursively up to the root
 * directory.
 */
export async function findFileRecurisvelyUpward(
  fileName: string
): Promise<null | string> {
  let found: null | string = null
  let currentDir = process.cwd()

  while (true) {
    const checkFilePath = Path.join(currentDir, fileName)

    if (await FS.existsAsync(checkFilePath)) {
      found = checkFilePath
      break
    }

    if (currentDir === '/') {
      break
    }

    currentDir = Path.dirname(currentDir)
  }

  return found
}

/**
 * Search for a file in cwd or in parent directory recursively up to the root
 * directory.
 */
export function findDirContainingFileRecurisvelyUpwardSync(
  fileName: string
): { path: string; dir: string } | null {
  let found: { path: string; dir: string } | null = null
  let currentDir = process.cwd()

  while (true) {
    const filePath = Path.join(currentDir, fileName)

    if (FS.exists(filePath)) {
      found = { dir: currentDir, path: filePath }
      break
    }

    if (currentDir === '/') {
      break
    }

    currentDir = Path.join(currentDir, '..')
  }

  return found
}

/**
 * Write file contents but first delete the file off disk if present. This is a
 * useful function when the effect of file delete is needed to trigger some file
 * watch/refresh mechanism, such as is the case with VSCode TS declaration files
 * inside `@types/` packages.
 *
 * For more details that motivated this utility refer to the originating issue
 * https://github.com/prisma-labs/nexus-prisma/issues/453.
 */
export const hardWriteFileSync = (filePath: string, data: string): void => {
  FS.remove(Path.dirname(filePath))
  FS.write(filePath, data)
}

/**
 * Return the path to a temporary directory on the machine. This works around a
 * limitation in Node wherein a symlink is returned on macOS for `os.tmpdir`.
 */
export function getTmpDir(prefix: string = '') {
  const tmpDirPath = NodeFS.realpathSync(OS.tmpdir())
  const id = Math.random()
    .toString()
    .slice(2)
  const dirName = [prefix, id].filter(x => x).join('-')

  // https://github.com/nodejs/node/issues/11422
  const tmpDir = Path.join(tmpDirPath, dirName)

  return tmpDir
}
