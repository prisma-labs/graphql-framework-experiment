import * as fs from 'fs-jetpack'
import { baseIgnores, flatMap, stripExt } from '../../utils'
import { Layout, relativeTranspiledImportPath } from '../layout'
import { log } from './logger'

/**
 * Find all the schema.ts modules or modules within a schema/ folder.
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
 * Find all modules called schema.ts or directories called schema.
 */
export function findDirOrModules(): string[] {
  // TODO async
  return fs
    .find({
      directories: false,
      files: true,
      recursive: true,
      matching: ['schema.ts', ...baseIgnores],
    })
    .concat(
      fs.find({
        directories: true,
        files: false,
        recursive: true,
        matching: ['schema', ...baseIgnores],
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
