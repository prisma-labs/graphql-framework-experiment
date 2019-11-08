import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import { findConfigFile } from './tsc'

const DEFAULT_ENTRY_POINTS = [
  // no nesting
  'index.ts',
  'main.ts',
  'app.ts',
  'server.ts',
  'schema.ts',
  // nested in src
  'src/index.ts',
  'src/main.ts',
  'src/app.ts',
  'src/server.ts',
  'src/schema.ts',
  'src/schema/index.ts',
  // nested in schema
  'schema/index.ts',
  'schema/main.ts',
  'schema/app.ts',
]

export function findServerEntryPoint(tsConfig: ts.ParsedCommandLine) {
  let entrypoint: string | undefined = undefined
  const packageJsonPath = findConfigFile('package.json', { required: false })

  if (packageJsonPath) {
    try {
      const packageJson: { main?: string } = JSON.parse(
        fs.readFileSync(packageJsonPath).toString()
      )

      if (packageJson.main) {
        entrypoint = sourceFilePathFromTranspiledPath({
          transpiledPath: packageJson.main,
          outDir: tsConfig.options.outDir!,
          rootDir: tsConfig.options.rootDir!,
          packageJsonPath,
        })
      }
    } catch (e) {
      console.log(
        `Warning: We were unable to infer the server entrypoint from your package.json file. ${e.message}`
      )
    } // TODO: Do we silently fail on purpose (in case it cannot parse the `package.json` file)
  }

  entrypoint = DEFAULT_ENTRY_POINTS.find(entryPointPath =>
    fs.existsSync(path.join(process.cwd(), entryPointPath))
  )

  if (!entrypoint) {
    throw new Error(
      `Could not find a valid entry point for your server. Possible entries: ${DEFAULT_ENTRY_POINTS.map(
        p => `"${p}"`
      ).join(', ')}`
    )
  }

  return entrypoint
}

export function findProjectDir() {
  let filePath = findConfigFile('tsconfig.json', { required: false })

  if (!filePath) {
    filePath = findConfigFile('package.json', { required: false })
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
