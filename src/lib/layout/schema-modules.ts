import Chalk from 'chalk'
import * as fs from 'fs-jetpack'
import { baseIgnores } from '../../lib/fs'

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
export function findDirOrModules(opts?: { cwd?: string }): string[] {
  const localFS = fs.cwd(opts?.cwd ?? process.cwd())
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
