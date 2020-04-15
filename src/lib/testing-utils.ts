import * as fs from 'fs-jetpack'
import * as path from 'path'

// In-memory file tree
export type FSSpec = {
  [path: string]: string | FSSpec
}

export function writeFSSpec(cwd: string, spec: FSSpec) {
  Object.entries(spec).forEach(([fileOrDirName, fileContentOrDir]) => {
    const subPath = path.join(cwd, fileOrDirName)

    if (typeof fileContentOrDir === 'string') {
      fs.write(subPath, fileContentOrDir)
    } else {
      writeFSSpec(subPath, { ...fileContentOrDir })
    }
  })
}
