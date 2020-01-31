import * as path from 'path'
import { run, RunOptions } from '../../src/utils'

export const createCLIRunner = (optionsBase?: RunOptions) => (
  command: string,
  options?: RunOptions
) => {
  const mergedOptions = { ...optionsBase, ...options }

  // TODO Why is the extra `../` needed...
  const entrypint = 'src/cli/index.ts'
  const pathToProject =
    '../' +
    path.relative(
      (mergedOptions as any)['cwd'] || '.',
      path.join(__dirname, '../..')
    )
  return run(
    `${pathToProject}/node_modules/.bin/ts-node --project ${pathToProject}/tsconfig.json ${pathToProject}/${entrypint} ${command}`,
    mergedOptions
  )
}
