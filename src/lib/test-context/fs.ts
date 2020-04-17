import { create } from './compose-create'
import * as FS from 'fs-jetpack'
import { FSJetpack } from 'fs-jetpack/types'

export interface FsContribution {
  fs: FSJetpack
}

export const fs = create(
  (opts: { tmpDir: string }): FsContribution => {
    return {
      fs: FS.cwd(opts.tmpDir),
    }
  }
)
