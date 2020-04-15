import { create } from './compose-create'
import * as fsJetPack from 'fs-jetpack'
import { FSJetpack } from 'fs-jetpack/types'

export interface FsContribution {
  fs: () => FSJetpack
}

export const fs = create(
  (opts: { tmpDir: () => string }): FsContribution => {
    return {
      fs: () => fsJetPack.cwd(opts.tmpDir()),
    }
  }
)
