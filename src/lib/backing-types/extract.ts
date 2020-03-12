import * as fs from 'fs-jetpack'
import { findFiles } from '../../utils'

export const defaultTSTypeMatcher = new RegExp(
  `export\\s+(?:interface|type|class|enum)\\s+(\\w+)`,
  'g'
)

export function findBackingTypesFiles(pattern?: string): Promise<string[]> {
  return findFiles(pattern ?? './**/*.ts')
}

export type BackingTypes = Record<string, string>

export function extractBackingTypesFromFiles(
  filePaths: (string | undefined)[]
): BackingTypes {
  const backingTypes: Record<string, string> = {}

  for (const filePath of filePaths) {
    if (!filePath) {
      continue
    }
    const fileContent = fs.read(filePath)!

    const typeNames = getMatches(fileContent, defaultTSTypeMatcher, 1)

    typeNames.forEach(typeName => {
      backingTypes[typeName] = filePath
    })
  }

  return backingTypes
}

function getMatches(stringToTest: string, regex: RegExp, index: number) {
  const matches = []
  let match

  while ((match = regex.exec(stringToTest))) {
    matches.push(match[index])
  }

  return matches
}
