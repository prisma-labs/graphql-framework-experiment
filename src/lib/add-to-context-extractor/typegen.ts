import { codeBlock } from 'common-tags'
import { NEXUS_DEFAULT_RUNTIME_CONTEXT_TYPEGEN_PATH } from '../../framework/schema/config'
import { hardWriteFile } from '../../utils'
import { ExtractedContectTypes } from './extractor'

/**
 * Output the context types to a typegen file.
 */
export async function writeContextTypeGenFile(
  contextTypes: ExtractedContectTypes
) {
  const addToContextInterfaces = contextTypes.types
    .map(result => `interface Context ${result}`)
    .join('\n\n')

  const content = codeBlock`
    import app from 'nexus-future'

    // Imports for types referenced by context types.

    ${contextTypes.typeImports
      .map(ti => renderImport({ names: [ti.name], from: ti.modulePath }))
      .join('\n')}

    // Tap into Nexus' global context interface. Make all local context interfaces merge into it.

    declare global {
      export interface NexusContext extends Context {}
    }

    // The context types extracted from the app.

    ${
      addToContextInterfaces.length > 0
        ? addToContextInterfaces
        : `interface Context {}`
    }
  `

  await hardWriteFile(NEXUS_DEFAULT_RUNTIME_CONTEXT_TYPEGEN_PATH, content)
}

function renderImport(input: { from: string; names: string[] }) {
  return `import { ${input.names.join(', ')} } from '${input.from}'`
}
