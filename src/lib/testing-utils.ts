import * as FS from 'fs-jetpack'
import * as Path from 'path'

// In-memory file tree
export type MemoryFS = {
  [path: string]: string | MemoryFS
}

export function writeToFS(cwd: string, vfs: MemoryFS) {
  Object.entries(vfs).forEach(([path, fileContentOrDir]) => {
    const absolutePath = Path.join(cwd, path)

    if (typeof fileContentOrDir === 'string') {
      FS.write(absolutePath, fileContentOrDir)
    } else {
      writeToFS(absolutePath, fileContentOrDir)
    }
  })
}
