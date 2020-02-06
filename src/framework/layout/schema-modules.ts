import Chalk from 'chalk'
import * as fs from 'fs-jetpack'
import { Layout, relativeTranspiledImportPath } from '.'
import { baseIgnores, flatMap, stripExt } from '../../utils'
import { log } from '../schema/logger'

export const MODULE_NAME = 'graphql'
export const FILE_NAME = MODULE_NAME + '.ts'
export const DIR_NAME = 'graphql'

export function emptyExceptionMessage() {
  // todo when the file is present but empty this error message is shown just
  // the same. That is poor user feedback because the instructions are wrong in
  // that case. The instructions in that case should be something like "you have
  // schema files setup correctly but they are empty"
  return `Your GraphQL schema is empty. This is normal if you have not defined any GraphQL types yet. But if you did, check that the file name follows the convention: all ${Chalk.yellow(
    FILE_NAME
  )} modules or direct child modules within a ${Chalk.yellow(
    DIR_NAME
  )} directory are automatically imported.`
}

/**
 * Find all the schema modules or child modules of a schema dir.
 *
 * The return value has two views.
 *
 * 1. `modules` is all modules found as described above.
 *
 * 2. `schemaDirsOrModules` is all occurances of the modules called schema or
 *    directories called schema. It does NOT include the modules _inside_ schema directory.
 */
function findModules(): {
  modules: string[]
  schemaDirsOrModules: string[]
} {
  log.trace('finding modules...')

  const schemaDirsOrModules = findDirOrModules()

  log.trace('...found', { dirsOrModules: schemaDirsOrModules })

  const modules = flatMap(schemaDirsOrModules, fileOrDir => {
    const absolutePath = fs.path(fileOrDir)

    if (fs.exists(absolutePath) === 'dir') {
      return fs
        .find(absolutePath, {
          files: true,
          directories: false,
          recursive: true,
          matching: '*.ts',
        })
        .map(f => fs.path(f))
    }

    return [absolutePath]
  })

  log.trace('... found final set (with dirs traversed)', {
    expandedModules: modules,
  })

  return { modules, schemaDirsOrModules }
}

/**
 * Find all modules called schema modules or directories having the trigger
 * name. This does not grab the child modules of the directory instances!
 */
export function findDirOrModules(): string[] {
  // TODO async
  return fs
    .find({
      directories: false,
      files: true,
      recursive: true,
      matching: [`${MODULE_NAME}.ts`, ...baseIgnores],
    })
    .concat(
      fs.find({
        directories: true,
        files: false,
        recursive: true,
        matching: [DIR_NAME, ...baseIgnores],
      })
    )
}

/**
 * Import schema modules for their side-effects.
 *
 * There is an IO cost here to go find all modules dynamically, so do not use in production.
 */
export function importModules(): void {
  findModules().modules.forEach(modulePath => {
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
  return findModules().modules.reduce((script, modulePath) => {
    const relPath = relativeTranspiledImportPath(layout, modulePath)
    return `${script}\n${printSideEffectsImport(relPath)}`
  }, '')
}

function printSideEffectsImport(modulePath: string): string {
  return `import '${modulePath}'`
}
