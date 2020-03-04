import { stripIndent } from 'common-tags'
import * as Path from 'path'
import ts from 'typescript'
import { Worker } from 'worker_threads'
import { Layout } from '../../framework/layout'
import { NEXUS_DEFAULT_RUNTIME_CONTEXT_TYPEGEN_PATH } from '../../framework/schema/config'
import { hardWriteFile } from '../../utils'
import { rootLogger } from '../../utils/logger'

const log = rootLogger.child('add-to-context-extractor')

export async function extractContextTypesToTypeGenFile(program: ts.Program) {
  const contextTypes = extractContextTypes(program)
  await writeContextTypeGenFile(contextTypes)
}

/**
 * Run the extractor in a worker.
 */
export function runAddToContextExtractorAsWorker(layout: Layout) {
  const worker = new Worker(Path.join(__dirname, './worker.js'), {
    workerData: {
      layout: layout.data,
    },
  })

  worker.once('message', (contextTypes: string[]) => {
    log.trace('finished context type extraction', { contextTypes })

    // Let the Node.js main thread exit, even though the Worker
    // is still running:
    worker.unref()
  })

  worker.on('error', (error: Error) => {
    log.warn(
      'We could not extract your context types from `schema.addToContext`',
      { error }
    )
  })
}

/**
 * Output the context types to a typegen file.
 */
export async function writeContextTypeGenFile(contextTypes: string[]) {
  const addToContextInterfaces = contextTypes
    .map(result => ` interface Context ${result}`)
    .join('\n\n')

  const contextTypesFileContent = stripIndent`
    import app from 'nexus-future'

    declare global {
      export interface NexusContext extends Context {}
    }

    ${
      addToContextInterfaces.length > 0
        ? addToContextInterfaces
        : `interface Context {}`
    }
  `

  await hardWriteFile(
    NEXUS_DEFAULT_RUNTIME_CONTEXT_TYPEGEN_PATH,
    contextTypesFileContent
  )
}

/**
 * Extract types from all `addToContext` calls.
 */
export function extractContextTypes(program: ts.Program): string[] {
  const checker = program.getTypeChecker()
  const contextTypeContributions: string[] = []

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
        contextTypeContributions.push(ContextAdderRetTpeString)
      }
    } else {
      n.forEachChild(visit)
    }
  }
}
