import * as fs from 'fs-jetpack'
import * as Path from 'path'

// In-memory file tree
export type FSSpec = {
  [path: string]: string | FSSpec
}

export function writeFSSpec(cwd: string, spec: FSSpec) {
  Object.entries(spec).forEach(([fileOrDirName, fileContentOrDir]) => {
    const fileOrDirPath = Path.join(cwd, fileOrDirName)

    if (typeof fileContentOrDir === 'string') {
      fs.write(fileOrDirPath, fileContentOrDir)
    } else {
      if (Object.keys(fileContentOrDir).length === 0) {
        fs.dir(fileOrDirPath)
      }
      writeFSSpec(fileOrDirPath, fileContentOrDir)
    }
  })
}
