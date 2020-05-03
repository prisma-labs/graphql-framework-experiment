import { execute, parse, Source, validate } from 'graphql'
import { AppState } from '../app'
import { log } from './logger'
import { NexusRequestHandler } from './server'

// interface NexusRequest {
//   // todo currently assumes request body has been parsed as JSON
//   body: Record<string, string>
// }

type CreateHandler = (appState: AppState) => NexusRequestHandler

export const createRequestHandlerGraphQL: CreateHandler = (appState: AppState) => async (req, res) => {
  const data = req.body
  const source = new Source(data.query)

  let documentAST
  try {
    documentAST = parse(source)
  } catch (syntaxError) {
    log.info('client request had syntax error', { syntaxError })
    // todo
    // https://github.com/graphql/express-graphql/blob/master/src/index.js
    return
  }

  const validationFailures = validate(appState.assembled!.schema, documentAST)

  if (validationFailures.length > 1) {
    log.info('client request failed validation', { validationFailures })
    // todo
    return
  }

  // todo validate that if operation is mutation or subscription then http method is not GET
  // https://github.com/graphql/express-graphql/blob/master/src/index.js#L296

  const context = await appState.assembled?.createContext(req)

  let result
  try {
    result = await execute({
      schema: appState.assembled!.schema,
      document: documentAST,
      contextValue: context,
      // todo other options
    })
  } catch (error) {
    log.error('failed while resolving client request', { error })
    // todo
    return
  }

  res.json(result)
}
