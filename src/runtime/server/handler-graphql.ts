import { isLeft } from 'fp-ts/lib/Either'
import { execute, parse, Source, validate } from 'graphql'
import createError from 'http-errors'
import { AppState } from '../app'
import { parseBody } from './parse-body'
import { NexusRequestHandler } from './server'
import { sendError, sendSuccess } from './utils'

type CreateHandler = (appState: AppState) => NexusRequestHandler

export const createRequestHandlerGraphQL: CreateHandler = (appState: AppState) => async (req, res) => {
  const errBody = await parseBody(req)

  if (isLeft(errBody)) {
    return sendError(res, errBody.left)
  }

  const body = errBody.right

  if (typeof body.query !== 'string') {
    return sendError(res, createError(400, 'request.body json expected to have a query field'))
  }

  const source = new Source(body.query)

  let documentAST
  try {
    documentAST = parse(source)
  } catch (syntaxError) {
    return sendError(res, createError(400, syntaxError))
  }

  const validationFailures = validate(appState.assembled!.schema, documentAST)

  if (validationFailures.length > 1) {
    return sendError(res, createError(400, 'GraphQL operation validation failed', { validationFailures }))
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
    return sendError(res, createError(500, 'failed while resolving client request', { error }))
  }

  sendSuccess(res, result)
}
