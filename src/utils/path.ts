import * as fs from 'fs'
import * as path from 'path'

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
