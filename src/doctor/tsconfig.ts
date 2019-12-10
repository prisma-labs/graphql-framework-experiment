import * as Layout from '../framework/layout'
import chalk from 'chalk'
import * as fs from 'fs-jetpack'
import * as Path from 'path'
import { stripIndent } from 'common-tags'
import { findConfigFile, createTSConfigContents } from '../utils/tsc'

export const name = 'tsconfig.json'

type Problem =
  | { kind: 'missing'; context: null }
  | { kind: 'not_root'; context: { path: string } }

export async function scanForProblem(
  layout: Layout.Layout
): Promise<null | Problem> {
  const path = findConfigFile('tsconfig.json', { required: false })

  if (path === null) {
    return { kind: 'missing', context: null }
  }

  if (Path.dirname(path) !== layout.projectRoot) {
    return { kind: 'not_root', context: { path } }
  }

  return null
}

/**
 * Find or scaffold a tsconfig.json file
 * Process will exit if package.json is not in the projectDir**
 */
export async function check(layout: Layout.Layout): Promise<void> {
  const maybeProblem = await scanForProblem(layout)

  if (!maybeProblem) return

  if (maybeProblem.kind === 'missing') {
    await fixMissing(layout)
    return
  }

  if (maybeProblem.kind === 'not_root') {
    console.error(
      chalk`{red ERROR:} Your tsconfig.json file needs to be in your project root directory`
    )
    console.error(
      chalk`{red ERROR:} Found ${
        maybeProblem.context.path
      }, expected ${Path.join(layout.projectRoot, 'tsconfig.json')}`
    )
    return
  }

  console.log(
    chalk`{green OK:} "tsconfig.json" is present and in the right directory`
  )
}

export async function fixMissing(layout: Layout.Layout): Promise<void> {
  const scaffoldPath = layout.projectRelative('tsconfig.json')

  console.log(stripIndent`
      ${chalk.green('Note:')} We could not find a "tsconfig.json" file.
      ${chalk.green('Note:')} We scaffolded one for you at ${scaffoldPath}.
    `)

  // It seems we cannot make `include` a comment below, because it is
  // evaluated at tsconfig read time, see this Stack-Overflow thread:
  // https://stackoverflow.com/questions/57333825/can-you-pull-in-excludes-includes-options-in-typescript-compiler-api
  //
  await fs.writeAsync(scaffoldPath, createTSConfigContents(layout))
}
