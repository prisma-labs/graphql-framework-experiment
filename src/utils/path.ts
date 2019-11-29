import * as fs from 'fs-jetpack'
import * as path from 'path'
import { findOrScaffold } from './scaffold'
import { findConfigFile } from './tsc'
import { pog } from './pog'

export const pumpkinsDotFolderName = 'pumpkins'

export const pumpkinsDotFolderPath = fs.path(`.${pumpkinsDotFolderName}`)

export const writePumpkinsFile = async (
  subPath: string,
  content: string
): Promise<void> => {
  await writeCachedFile(pumpkinsPath(subPath).absolute, content)
}

export const pumpkinsPath = (
  subPath: string
): { relative: string; absolute: string } => {
  return {
    relative: subPath,
    absolute: path.join(pumpkinsDotFolderPath, subPath),
  }
}

export const writeCachedFile = async (
  filePath: string,
  fileContent: string
): Promise<void> => {
  const alreadyExistingFallbackFileContents = fs.read(filePath)

  if (alreadyExistingFallbackFileContents === undefined) {
    pog('writing file %s', filePath)
    await fs.writeAsync(filePath, fileContent)
  } else if (alreadyExistingFallbackFileContents !== fileContent) {
    pog(
      'there is a file already present on disk but its content does not match, replacing old with new %s',
      filePath
    )
    pog(alreadyExistingFallbackFileContents)
    pog(fileContent)
    await fs.writeAsync(filePath, fileContent)
  } else {
    pog(
      'there is a file already present on disk and its content matches, therefore doing nothing'
    )
  }
}

// build/index.js => index.ts

export function getTranspiledPath(
  projectDir: string,
  filePath: string,
  outDir: string
) {
  const pathFromRootToFile = path.relative(projectDir, filePath)
  const jsFileName = path.basename(pathFromRootToFile, '.ts') + '.js'
  const pathToJsFile = path.join(path.dirname(pathFromRootToFile), jsFileName)

  return path.join(outDir, pathToJsFile)
}

// build/index.js => /Users/me/project/src/index.ts

export function sourceFilePathFromTranspiledPath({
  transpiledPath,
  outDir,
  rootDir,
  packageJsonPath,
}: {
  transpiledPath: string
  outDir: string
  rootDir: string
  packageJsonPath: string
}) {
  const normalizedTranspiledPath = transpiledPath.startsWith('/')
    ? transpiledPath
    : path.join(packageJsonPath, transpiledPath)

  const pathFromOutDirToFile = path.relative(outDir, normalizedTranspiledPath)
  const tsFileName = path.basename(pathFromOutDirToFile, '.js') + '.ts'
  const maybeAppFolders = path.dirname(pathFromOutDirToFile)

  return path.join(rootDir, maybeAppFolders, tsFileName)
}

export function findFile(
  fileNames: string | string[],
  config?: { ignore?: string[] }
): null | string {
  const paths = Array.isArray(fileNames) ? fileNames : [fileNames]
  const foundFiles = fs.find({
    matching: [
      ...paths,
      '!node_modules/**/*',
      '!.yalc/**/*',
      `!.${pumpkinsDotFolderName}/**/*`,
      ...(config?.ignore?.map(i => `!${i}`) ?? []),
    ],
  })

  // TODO: What if several files were found?
  if (foundFiles.length > 0) {
    return path.join(process.cwd(), foundFiles[0])
  }

  return null
}

export async function findFiles(
  fileNames: string | string[],
  config?: { ignore?: string[] }
): Promise<string[]> {
  const paths = Array.isArray(fileNames) ? fileNames : [fileNames]
  return fs.findAsync({
    matching: [
      ...paths,
      ...baseIgnores,
      ...(config?.ignore?.map(i => `!${i}`) ?? []),
    ],
  })
}

export const baseIgnores = [
  '!node_modules/**/*',
  '!.yalc/**/*',
  `!.${pumpkinsDotFolderName}/**/*`,
]

export function trimNodeModulesIfInPath(path: string) {
  if (path.includes('node_modules')) {
    return path.substring(
      path.indexOf('node_modules') + 'node_modules'.length + 1
    )
  }

  return path
}

/**
 * Strip the extension of a file path.
 *
 * This can be handy for example when going from a file to a module path
 * suitable for import like a user would do, not supplying the ext.
 */
export function stripExt(filePath: string): string {
  const { dir, name } = path.parse(filePath)
  return path.join(dir, name)
}
