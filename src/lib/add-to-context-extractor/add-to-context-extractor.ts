import * as Path from 'path'
import ts from 'typescript'
import * as Layout from '../../lib/layout'
import { rootLogger } from '../nexus-logger'
import { extractContextTypes, ExtractedContectTypes } from './extractor'
import { writeContextTypeGenFile } from './typegen'

const log = rootLogger.child('add-to-context-extractor')

/**
 * Run the pure extractor and then write results to a typegen module.
 */
export async function extractContextTypesToTypeGenFile(program: ts.Program) {
  const contextTypes = extractContextTypes(program)

  await writeContextTypeGenFile(contextTypes)
}
