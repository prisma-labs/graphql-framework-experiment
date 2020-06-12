import { Either, right } from 'fp-ts/lib/Either'
import { rootLogger } from '../nexus-logger'
import { create, createFromData, Data, Layout } from './layout'

const ENV_VAR_DATA_NAME = 'NEXUS_LAYOUT'

const log = rootLogger.child('layout')

export function saveDataForChildProcess(layout: Layout): { NEXUS_LAYOUT: string } {
  return {
    [ENV_VAR_DATA_NAME]: JSON.stringify(layout.data),
  }
}

/**
 * Load the layout data from a serialized version stored in the environment. If
 * it is not found then a warning will be logged and it will be recalculated.
 * For this reason the function is async however under normal circumstances it
 * should be as-if sync.
 */
export async function loadDataFromParentProcess(): Promise<Either<Error, Layout>> {
  const savedData: undefined | string = process.env[ENV_VAR_DATA_NAME]
  if (!savedData) {
    log.trace(
      'WARNING an attempt to load saved layout data was made but no serialized data was found in the environment. This may represent a bug. Layout is being re-calculated as a fallback solution. This should result in the same layout data (if not, another probably bug, compounding confusion) but at least adds latentency to user experience.'
    )
    return create({}) // todo no build output...
  } else {
    // todo guard against corrupted env data
    return right(createFromData(JSON.parse(savedData) as Data))
  }
}
