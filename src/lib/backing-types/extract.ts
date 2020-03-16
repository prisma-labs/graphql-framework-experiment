import * as fs from 'fs-jetpack'
import { rootLogger } from '../nexus-logger'
import { BackingTypes } from './types'
import { Layout } from '../layout'
import { createTSProgram } from '../tsc'
import anymatch from 'anymatch'
import { DEFAULT_BACKING_TYPES_GLOB } from './find'
import * as ts from 'typescript'

const log = rootLogger.child('backing-types')

export const defaultTSTypeMatcher = new RegExp(
  `export\\s+(?:interface|type|class|enum)\\s+(\\w+)`,
  'g'
)

export function extractWithTS(
  layout: Layout,
  filePattern?: string
): BackingTypes {
  const program = createTSProgram(layout, { withCache: true })

  return extractFromTSProgram(program.getProgram(), filePattern)
}

export function extractFromTSProgram(
  program: ts.Program,
  filePattern?: string
): BackingTypes {
  const fileMatcher = anymatch(filePattern ?? DEFAULT_BACKING_TYPES_GLOB)
  const appSourceFiles = program
    .getSourceFiles()
    .filter(s => fileMatcher(s.fileName) && !s.fileName.match(/node_modules/))
  console.log({ sourcesFiles: appSourceFiles.map(s => s.fileName) })
  const backingTypes: BackingTypes = {}

  appSourceFiles.forEach(s => {
    visit(s, 'root')
  })

  return backingTypes

  function visit(n: ts.Node, namespace: string) {
    if (isNamedType(n) && isNodeExported(n)) {
      const typeName = n.name?.escapedText

      if (!typeName) {
        throw new Error('Type must have a name')
      }

      backingTypes[typeName.toString()] = n.getSourceFile().fileName
      return false
    }

    n.forEachChild(s => {
      visit(s, 'root')
    })
  }
}

function isNamedType(
  node: ts.Node
): node is
  | ts.InterfaceDeclaration
  | ts.TypeAliasDeclaration
  | ts.EnumDeclaration
  | ts.ClassDeclaration {
  return (
    ts.isInterfaceDeclaration(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isEnumDeclaration(node) ||
    ts.isClassDeclaration(node)
  )
}

function isNodeExported(node: ts.Node): boolean {
  return (
    (ts.getCombinedModifierFlags(node as ts.Declaration) &
      ts.ModifierFlags.Export) !==
    0
  )
}

export function extract(filePaths: (string | undefined)[]): BackingTypes {
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
