import * as fs from 'fs'
import * as FsJetpack from 'fs-jetpack'
import * as Path from 'path'

// In-memory file tree
export type MemoryFS = {
  [path: string]: string | MemoryFS
}

export function writeToFS(cwd: string, vfs: MemoryFS) {
  Object.entries(vfs).forEach(([path, fileContentOrDir]) => {
    const absolutePath = Path.join(cwd, path)

    if (typeof fileContentOrDir === 'string') {
      if (!fs.existsSync(Path.dirname(absolutePath))) {
        FsJetpack.dir(Path.dirname(absolutePath))
      }

      fs.writeFileSync(absolutePath, fileContentOrDir)
    } else {
      writeToFS(absolutePath, fileContentOrDir)
    }
  })
}
