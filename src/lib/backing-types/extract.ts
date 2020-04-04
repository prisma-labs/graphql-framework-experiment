import * as fs from 'fs-jetpack'
import { rootLogger } from '../nexus-logger'
import { BackingTypes } from './types'

const log = rootLogger.child('backing-types')

export const defaultTSTypeMatcher = new RegExp(
  `export\\s+(?:interface|type|class|enum)\\s+(\\w+)`,
  'g'
)

export function extract(filePaths: (string | undefined)[]): BackingTypes {
  const backingTypes: Record<string, string> = {}

  for (const filePath of filePaths) {
    if (!filePath) {
      continue
    }
    const fileContent = fs.read(filePath)!

    const typeNames = getMatches(fileContent, defaultTSTypeMatcher, 1)

    typeNames.forEach((typeName) => {
      backingTypes[typeName] = filePath
    })
  }

  log.trace('extracted backing types from file', { backingTypes })

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
