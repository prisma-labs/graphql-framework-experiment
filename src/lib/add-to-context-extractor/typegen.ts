import { codeBlock } from 'common-tags'
import { Either, isLeft, right } from 'fp-ts/lib/Either'
import * as fs from 'fs-jetpack'
import { hardWriteFile } from '../fs'
import * as Layout from '../layout'
import { rootLogger } from '../nexus-logger'
import { createTSProgram } from '../tsc'
import { ContribType, extractContextTypes, ExtractedContextTypes } from './extractor'

const log = rootLogger.child('addToContextExtractor')

export const NEXUS_DEFAULT_RUNTIME_CONTEXT_TYPEGEN_PATH = fs.path(
  'node_modules',
  '@types',
  'typegen-nexus-context',
  'index.d.ts'
)

/**
 * Run the pure extractor and then write results to a typegen module.
 */
export async function generateContextExtractionArtifacts(
  layout: Layout.Layout
): Promise<Either<Error, ExtractedContextTypes>> {
  log.trace('starting context type extraction')
  const errProgram = createTSProgram(layout, { withCache: true })
  if (isLeft(errProgram)) return errProgram
  const program = errProgram.right
  const contextTypes = extractContextTypes(program.getProgram())

  await writeContextTypeGenFile(contextTypes)

  log.trace('finished context type extraction', { contextTypes })

  return right(contextTypes)
}

/**
 * Output the context types to a typegen file.
 */
export async function writeContextTypeGenFile(contextTypes: ExtractedContextTypes) {
  let addToContextInterfaces = contextTypes.types
    .map(renderContextInterfaceForExtractedReturnType)
    .join('\n\n')

  if (addToContextInterfaces.trim() === '') {
    addToContextInterfaces = `interface Context {} // none\n\n`
  }

  const content = codeBlock`
    import app from 'nexus'

    // Imports for types referenced by context types.

    ${contextTypes.typeImports
      .map((ti) => renderImport({ names: [ti.name], from: ti.modulePath }))
      .join('\n')}

    // Tap into Nexus' global context interface. Make all local context interfaces merge into it.

    declare global {
      export interface NexusContext extends Context {}
    }

    // The context types extracted from the app.

    ${addToContextInterfaces}
  `

  await hardWriteFile(NEXUS_DEFAULT_RUNTIME_CONTEXT_TYPEGEN_PATH, content)
}

function renderImport(input: { from: string; names: string[] }) {
  return `import { ${input.names.join(', ')} } from '${input.from}'`
}

function renderContextInterfaceForExtractedReturnType(contribType: ContribType): string {
  switch (contribType.kind) {
    case 'literal':
      return `interface Context ${contribType.value}`
    case 'ref':
      return `interface Context extends ${contribType.name}`
  }
}
