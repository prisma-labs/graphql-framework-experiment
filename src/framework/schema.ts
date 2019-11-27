import * as fs from 'fs-jetpack'
import { pog, flatMap, baseIgnores, stripExt } from '../utils'
import { Layout, relativeTranspiledImportPath } from './layout'
// import { stripIndents } from 'common-tags'

const log = pog.sub(__filename)

export function findSchemaDirOrModules(): string[] {
  return fs.find({
    directories: true,
    files: true,
    recursive: true,
    matching: ['schema', 'schema.ts', ...baseIgnores],
  })
}

function findSchemaModules(): {
  expandedModules: string[]
  dirsOrModules: string[]
} {
  log('finding modules...')

  const dirsOrModules = findSchemaDirOrModules()

  log('...found %O', dirsOrModules)

  // if (files.length === 0) {
  //   const schemaPath = fs.path('.pumpkins', 'schema.ts')

  //   fs.write(
  //     schemaPath,
  //     stripIndents`
  //       // Move out of folder to edit, or create a new one in your app folder.

  //       queryType({
  //         definition(t) {
  //           t.string('welcomeToPumpkins', () => 'Welcome to Pumpkins!')
  //         }
  //       })
  //     `
  //   )

  //   return [schemaPath]
  // }

  const expandedModules = flatMap(dirsOrModules, fileOrDir => {
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

  log('... found final set (with dirs traversed) %O', expandedModules)

  return { expandedModules, dirsOrModules }
}

export function requireSchemaModules(): void {
  findSchemaModules().expandedModules.forEach(modulePath => {
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
export function printStaticSchemaImports(layout: Layout): string {
  return findSchemaModules().expandedModules.reduce((script, modulePath) => {
    const relPath = relativeTranspiledImportPath(layout, modulePath)
    return `${script}\n${printSideEffectsImport(relPath)}`
  }, '')
}

function printSideEffectsImport(modulePath: string): string {
  return `import '${modulePath}'`
}
