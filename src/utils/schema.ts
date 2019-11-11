import * as fs from 'fs-jetpack'
import { debug } from '.'

function findSchemaModules(): string[] {
  debug('finding schema modules ...')

  const files = fs.find({
    directories: true,
    files: true,
    matching: ['schema', 'schema.ts', '!node_modules/**/*', '!.yalc/**/*'],
  })

  if (files.length === 0) {
    throw new Error(
      'Could not find a schema. You either need a "schema.ts" file or a "schema" folder.'
    )
  }

  if (files.length > 1) {
    throw new Error(
      `You have more than one "schema" module: ${files
        .map(f => `"${f}"`)
        .join(', ')}`
    )
  }

  const fileOrDir = files[0]
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
}

export function requireSchemaModules(): void {
  findSchemaModules().forEach(mod => require(mod))
}
