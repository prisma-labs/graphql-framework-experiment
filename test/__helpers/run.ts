import { RunOptions, run } from '../../src/utils'
import * as path from 'path'

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
  // console.log(pathToProject)
  return run(
    `${pathToProject}/node_modules/.bin/ts-node --project ${pathToProject}/tsconfig.json ${pathToProject}/${entrypint} ${command}`,
    mergedOptions
  )
}
