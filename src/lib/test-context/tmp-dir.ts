import { create } from './compose-create'
import { getTmpDir } from '../../utils'

interface TmpDirContribution {
  tmpDir: () => string
}

export const tmpDir = create(
  (opts?: { prefix: string }): TmpDirContribution => {
    let tmpDir: string | null = null

    beforeEach(() => {
      tmpDir = getTmpDir(opts?.prefix)
    })

    return {
      tmpDir: () => tmpDir!,
    }
  }
)
