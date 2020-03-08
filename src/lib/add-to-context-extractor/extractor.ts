import * as Path from 'path'
import * as tsm from 'ts-morph'
import ts from 'typescript'
import { rootLogger } from '../../utils/logger'

const log = rootLogger.child('add-to-context-extractor')

export interface ExtractedContectTypes {
  typeImports: { name: string; modulePath: string; isExported: boolean }[]
  // types: Record<string, string>[]
  types: string[]
}

/**
 * Extract types from all `addToContext` calls.
 */
export function extractContextTypes(
  program: ts.Program
): ExtractedContectTypes {
  const checker = program.getTypeChecker()

  const contextTypeContributions: ExtractedContectTypes = {
    typeImports: [],
    types: [],
  }

  const appSourceFiles = program
    .getSourceFiles()
    .filter(sf => !sf.fileName.match(/node_modules/))

  log.trace('got app source files', {
    count: appSourceFiles.length,
    files: appSourceFiles.map(sf => sf.fileName),
  })

  appSourceFiles.forEach(visit)

  log.trace('finished compiler extension processing', {
    contextTypeContributions,
  })

  return contextTypeContributions

  /**
   * Given a node, traverse the tree of nodes under it.
   */
  function visit(n: ts.Node) {
    // log.trace('visiting node', {
    //   kindNum: n.kind,
    //   kindName: ts.SyntaxKind[n.kind],
    //   text: n.getText(),
    // })

    if (ts.isCallExpression(n)) {
      const firstToken = n.getFirstToken()
      const lastToken = n.expression.getLastToken()
      if (
        firstToken !== undefined &&
        ts.isIdentifier(firstToken) &&
        firstToken.text === 'schema' &&
        lastToken !== undefined &&
        ts.isIdentifier(lastToken) &&
        lastToken.text === 'addToContext'
      ) {
        log.trace('found call', {
          text: lastToken.getText(),
        })

        // Get the argument passed to addToContext so we can extract its type
        if (n.arguments.length === 0) {
          log.trace(
            'no args passed to call, the user should see a static type error, stopping extraction'
          )
          return
        }
        if (n.arguments.length > 1) {
          log.trace(
            'multiple args passed to call, the user should see a static type error, stopping extraction'
          )
          return
        }
        const contextAdder = n.arguments[0]
        const contextAdderType = checker.getTypeAtLocation(contextAdder)
        const contextAdderSigs = contextAdderType.getCallSignatures()
        log.trace('found call arg', { text: contextAdder.getText() })

        // Get the signature of the argument so we can extract its return type
        if (contextAdderSigs.length === 0) {
          log.trace(
            'arg had no signatures, this means the user passed a non-callable, the user should see a static type error, stopping context type extraction'
          )
          return
        }
        if (contextAdderSigs.length > 1) {
          log.warn(
            'An overloaded function passed to addToContext. The first signature will be taken. This choice is arbitrary and may result in bad context extraction.',
            { text: contextAdder.getText() }
          )
        }
        const contextAdderSig = contextAdderSigs[0]
        const ContextAdderRetType = checker.getReturnTypeOfSignature(
          contextAdderSig
        )
        const ContextAdderRetTpeString = checker.typeToString(
          ContextAdderRetType
        )
        contextTypeContributions.types.push(ContextAdderRetTpeString)

        // search for named references, they will require importing later on
        const contextAdderRetProps = ContextAdderRetType.getProperties()
        for (const prop of contextAdderRetProps) {
          const propType = checker.getTypeAtLocation(prop.declarations[0])
          let sym = propType.aliasSymbol
          let name = sym?.getName()
          if (!sym) {
            sym = propType.getSymbol()
            if (!sym) continue
            name = sym.getName()
            // not alias but is inline, then skip
            if (name === '__object') continue
            if (name === '__type') continue
          }
          if (!name) continue
          const d = sym.getDeclarations()?.[0]
          if (!d)
            throw new Error(
              'A type with a symbol but the symbol has no declaration'
            )
          const sourceFile = tsm
            .createWrappedNode(d, { typeChecker: checker })
            .getSourceFile()
          contextTypeContributions.typeImports.push({
            name: sym.getName(),
            modulePath: getAbsoluteImportPath(sourceFile),
            isExported: sourceFile.getExportedDeclarations().has(name),
          })
          // types[prop.getName()] = checker.typeToString(propType)
        }
      }
    } else {
      n.forEachChild(visit)
    }
  }
}

function getAbsoluteImportPath(sourceFile: tsm.SourceFile): string {
  return Path.join(
    Path.dirname(sourceFile.getFilePath()),
    sourceFile.getBaseNameWithoutExtension()
  )
}
