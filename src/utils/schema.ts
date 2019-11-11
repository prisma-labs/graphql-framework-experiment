import * as fs from 'fs-jetpack'
import { debug, flatMap } from '../utils'

function findSchemaModules(): string[] {
  debug.schema('finding schema modules ...')

  const files = fs.find({
    directories: true,
    files: true,
    recursive: true,
    matching: ['schema', 'schema.ts', '!node_modules/**/*', '!.yalc/**/*'],
  })

  if (files.length === 0) {
    const schemaPath = fs.path('.pumpkins', 'schema.ts')

    fs.write(
      schemaPath,
      `
// Move out of folder to edit, or create a new one in your app folder.

queryType({
  definition(t) {
    t.string('welcomeToPumpkins', () => 'Welcome to Pumpkins!')
  }
})
`
    )

    console.warn(
      'Could not find a schema. We created one for you in ".pumpkins/schema.ts"'
    )

    return [schemaPath]
  }

  return flatMap(files, fileOrDir => {
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

    return [fs.path(fileOrDir)]
  })
}

export function requireSchemaModules(): void {
  findSchemaModules().forEach(mod => require(mod))
}
