import * as fs from 'fs-jetpack'
import * as path from 'path'
import { findOrScaffold } from './scaffold'
import { findConfigFile } from './tsc'

export const pumpkinsDotFolderName = 'pumpkins'

export const pumpkinsDotFolderPath = fs.path(`.${pumpkinsDotFolderName}`)

export const pumpkinsPath = (subPath: string): string => {
  return path.join(pumpkinsDotFolderPath, subPath)
}

export const writePumpkinsFile = (
  fileName: string,
  fileContent: string
): void => {
  fs.write(pumpkinsPath(fileName), fileContent)
}

export function findServerEntryPoint() {
  // TODO if user has disabled global singleton, then honour that here
  return findOrScaffold({
    fileNames: ['app.ts', 'server.ts', 'service.ts'],
    fallbackPath: fs.path('.pumpkins', 'app.ts'),
    fallbackContent: `
    app.server.start()
    `,
  })
}

export function findProjectDir() {
  let filePath = findConfigFile('package.json', { required: false })

  if (!filePath) {
    filePath = findConfigFile('tsconfig.json', { required: false })
  }

  if (!filePath) {
    throw new Error(
      'Could not find the project directory. A "package.json" or "tsconfig.json" file is required.'
    )
  }

  return path.dirname(filePath)
}
// dist/index.js => index.ts
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

// dist/index.js => /Users/me/project/src/index.ts

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

export function findFile(fileNames: string[]) {
  const foundFiles = fs.find({
    matching: [
      ...fileNames,
      '!node_modules/**/*',
      '!.yalc/**/*',
      `!.${pumpkinsDotFolderName}/**/*`,
    ],
  })

  // TODO: What if several files were found?
  if (foundFiles.length > 0) {
    return path.join(process.cwd(), foundFiles[0])
  }

  return undefined
}

export const trimExt = (filePath: string, ext: string): string => {
  return path.join(path.dirname(filePath), path.basename(filePath, ext))
}

export function trimNodeModulesIfInPath(path: string) {
  if (path.includes('node_modules')) {
    return path.substring(
      path.indexOf('node_modules') + 'node_modules'.length + 1
    )
  }

  return path
}
