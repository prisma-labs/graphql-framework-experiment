import * as FS from 'fs-jetpack'
import { FSJetpack } from 'fs-jetpack/types'
import { create } from './compose-create'

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
