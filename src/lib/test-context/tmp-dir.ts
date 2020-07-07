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
    const baseTmpDir = process.env.CI !== undefined && os.platform() === 'win32' ?
      'C:\\Users\\runneradmin\\AppData\\Local\\Temp' : undefined
    const tmpDir = getTmpDir(opts?.prefix, baseTmpDir)

    fs.dir(tmpDir)

    return { tmpDir }
  })
