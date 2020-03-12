import Chalk from 'chalk'
import * as fs from 'fs-jetpack'
import {
  Layout,
  loadDataFromParentProcess,
  relativeTranspiledImportPath,
} from '.'
import { baseIgnores, stripExt } from '../../utils'

export const MODULE_NAME = 'graphql'
export const CONVENTIONAL_SCHEMA_FILE_NAME = MODULE_NAME + '.ts'
export const DIR_NAME = 'graphql'

export function emptyExceptionMessage() {
  // todo when the file is present but empty this error message is shown just
  // the same. That is poor user feedback because the instructions are wrong in
  // that case. The instructions in that case should be something like "you have
  // schema files setup correctly but they are empty"
  return `Your GraphQL schema is empty. This is normal if you have not defined any GraphQL types yet. But if you did, check that the file name follows the convention: all ${Chalk.yellow(
    CONVENTIONAL_SCHEMA_FILE_NAME
  )} modules or direct child modules within a ${Chalk.yellow(
    DIR_NAME
  )} directory are automatically imported.`
}

/**
 * Find all modules called schema modules or directories having the trigger
 * name. This does not grab the child modules of the directory instances!
 */
export function findDirOrModules(
  opts: { cwd: string } = { cwd: process.cwd() }
): string[] {
  const localFS = fs.cwd(opts.cwd)
  // TODO async
  const files = localFS.find({
    files: true,
    recursive: true,
    matching: [
      CONVENTIONAL_SCHEMA_FILE_NAME,
      `**/${MODULE_NAME}/**/*.ts`,
      ...baseIgnores,
    ],
  })

  return files.map(f => localFS.path(f))
}

/**
 * Import schema modules for their side-effects.
 *
 * There is an IO cost here to go find all modules dynamically, so do not use in production.
 */
export async function importModules(layout: Layout): Promise<void> {
  layout.schemaModules.forEach(modulePath => {
    require(stripExt(modulePath))
  })
}

/**
 * Build up static import code for all schema modules in the project. The static
 * imports are relative so that they can be calculated based on source layout
 * but used in build layout.
 *
 * Note that it is assumed the module these imports will run in will be located
 * in the source/build root.
 */
export function printStaticImports(layout: Layout): string {
  return layout.schemaModules.reduce((script, modulePath) => {
    const relPath = relativeTranspiledImportPath(layout, modulePath)
    return `${script}\n${printSideEffectsImport(relPath)}`
  }, '')
}

function printSideEffectsImport(modulePath: string): string {
  return `import '${modulePath}'`
}
