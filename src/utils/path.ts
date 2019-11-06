import * as fs from 'fs'
import * as path from 'path'
import { findConfigFile } from './tsc'

export function findServerEntryPoint() {
  const defaultEntryPoints = [
    'index.ts',
    'main.ts',
    'server.ts',
    'schema.ts',
    'src/index.ts',
    'src/main.ts',
    'src/server.ts',
    'src/schema.ts',
    'src/schema/index.ts',
    'schema/index.ts',
  ]

  const entryPoint = defaultEntryPoints.find(entryPointPath =>
    fs.existsSync(path.join(process.cwd(), entryPointPath))
  )

  if (!entryPoint) {
    throw new Error(
      `Could not find a valid entry point for your server. Possible entries: ${defaultEntryPoints
        .map(p => `"${p}"`)
        .join(', ')}`
    )
  }

  return entryPoint
}

export function findProjectDir() {
  let filePath = findConfigFile('tsconfig.json', { required: false })

  if (!filePath) {
    filePath = findConfigFile('package.json', { required: false })
  }

  if (!filePath) {
    throw new Error('Could not find the project directory. A "package.json" or "tsconfig.json" file is required.')
  }

  return path.dirname(filePath)
}

export function getTranspiledPath(
  projectDir: string,
  filePath: string,
  outDir: string,
) {
  const pathFromRootToFile = path.relative(projectDir, filePath)
  const jsFileName = path.basename(pathFromRootToFile, '.ts') + '.js'
  const pathToJsFile = path.join(path.dirname(pathFromRootToFile), jsFileName)

  return path.join(outDir, pathToJsFile)
}
