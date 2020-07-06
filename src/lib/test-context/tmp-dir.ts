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
      process.env.TMP = 'C:\\Users\\runneradmin\\AppData\\Local\\Temp'
      process.env.TEMP = 'C:\\Users\\runneradmin\\AppData\\Local\\Temp'
    }

    console.log({
      ci: process.env.CI,
      os: os.platform(),
      TMP: process.env.TMP,
      TEMP: process.env.TEMP,
      tmpdir: os.tmpdir()
    })
  
    const tmpDir = getTmpDir(opts?.prefix)

    console.log({
      tmpDir
    })

    fs.dir(tmpDir)

    return { tmpDir }
  })
