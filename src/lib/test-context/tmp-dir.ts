import * as fs from 'fs-jetpack'
import { FSJetpack } from 'fs-jetpack/types'
import { getTmpDir } from '../fs'
import { create } from './compose-create'

export interface TmpDirContribution {
  tmpDir: string
  fs: FSJetpack
}

export const tmpDir = create(
  (opts?: { prefix: string }): TmpDirContribution => {
    const tmpDir = getTmpDir(opts?.prefix)

    fs.dir(tmpDir)

    return { tmpDir, fs: fs.cwd(tmpDir) }
  }
)
