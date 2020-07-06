import * as fs from 'fs-jetpack'
import * as os from 'os'
import { getTmpDir } from '../fs'
import { createContributor } from './compose-create'

export type TmpDirDeps = {}

export type TmpDirContribution = {
  tmpDir: string
}

export const tmpDir = (opts?: { prefix: string }) =>
  createContributor<TmpDirDeps, TmpDirContribution>(() => {
    // Huge hack to force the tmpdir to be in its "long" form in the GH CI for windows
    if (process.env.CI !== undefined && os.platform() === 'win32') {
      return { tmpDir: 'C:\\Users\\runneradmin\\AppData\\Local\\Temp' }
    }
  
    const tmpDir = getTmpDir(opts?.prefix)

    fs.dir(tmpDir)

    return { tmpDir }
  })
