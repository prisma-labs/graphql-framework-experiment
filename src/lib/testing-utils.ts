import * as FS from 'fs-jetpack'
import * as Path from 'path'

// In-memory file tree
export type MemoryFS = {
  [path: string]: string | MemoryFS
}

export function writeToFS(cwd: string, vfs: MemoryFS) {
  Object.entries(vfs).forEach(([fileOrDirName, fileContentOrDir]) => {
    const subPath = Path.join(cwd, fileOrDirName)

    if (typeof fileContentOrDir === 'string') {
      FS.write(subPath, fileContentOrDir)
    } else {
      writeToFS(subPath, { ...fileContentOrDir })
    }
  })
}
