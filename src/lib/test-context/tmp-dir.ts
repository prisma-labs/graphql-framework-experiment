import * as fs from 'fs-jetpack'
import { getTmpDir } from '../fs'
import { createContributor } from './compose-create'

export type TmpDirDeps = {}

export type TmpDirContribution = {
  tmpDir: string
}

export const tmpDir = (opts?: { prefix: string }) =>
  createContributor<TmpDirDeps, TmpDirContribution>(() => {
    const tmpDir = getTmpDir(opts?.prefix)

    fs.dir(tmpDir)

    return { tmpDir }
  })
