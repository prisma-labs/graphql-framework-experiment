import { codeBlock } from 'common-tags'
import { Either, isLeft } from 'fp-ts/lib/Either'
import * as fs from 'fs-jetpack'
import slash from 'slash'
import { hardWriteFile } from '../fs'
import * as Layout from '../layout'
import { rootLogger } from '../nexus-logger'
import { createTSProject } from '../tsc'
import { Exception, prettyImportPath } from '../utils'
import { ContribType, extractContextTypes, ExtractedContextTypes } from './extractor'

const log = rootLogger.child('addToContextExtractor')

export const NEXUS_DEFAULT_RUNTIME_CONTEXT_TYPEGEN_PATH = fs.path(
  'node_modules',
  '@types',
  'typegen-nexus-context',
  'index.d.ts'
)

export const DEFAULT_CONTEXT_TYPES: ExtractedContextTypes = {
  typeImports: [
    {
      name: 'ContextAdderLens',
      modulePath: prettyImportPath(require.resolve('../../runtime/schema/schema')),
      isExported: true,
      isNode: false,
    },
  ],
  types: [{ kind: 'ref', name: 'ContextAdderLens' }],
}

/**
 * Run the pure extractor and then write results to a typegen module.
 */
export async function generateContextExtractionArtifacts(
  layout: Layout.Layout
): Promise<Either<Exception, ExtractedContextTypes>> {
  log.trace('starting context type extraction')
  const errProject = createTSProject(layout, { withCache: true })
  if (isLeft(errProject)) return errProject
  const tsProject = errProject.right
  const contextTypes = extractContextTypes(tsProject, DEFAULT_CONTEXT_TYPES)

  if (isLeft(contextTypes)) {
    return contextTypes
  }

  await writeContextTypeGenFile(contextTypes.right)

  log.trace('finished context type extraction', { contextTypes })

  return contextTypes
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
  return `import { ${input.names.join(', ')} } from '${slash(input.from)}'`
}

function renderContextInterfaceForExtractedReturnType(contribType: ContribType): string {
  switch (contribType.kind) {
    case 'literal':
      return `interface Context ${contribType.value}`
    case 'ref':
      return `interface Context extends ${contribType.name} {}`
  }
}
