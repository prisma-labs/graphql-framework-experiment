import { Either, isLeft, left, right } from 'fp-ts/lib/Either'
import { execute, parse, Source, validate } from 'graphql'
import { IncomingMessage } from 'http'
import createError, { HttpError } from 'http-errors'
import url from 'url'
import { AppState } from '../app'
import { parseBody } from './parse-body'
import { NexusRequestHandler } from './server'
import { sendError, sendSuccess } from './utils'

type CreateHandler = (appState: AppState) => NexusRequestHandler

type GraphQLParams = {
  query: null | string
  variables: null | Record<string, unknown>
  operationName: null | string
  raw: boolean
}

export const createRequestHandlerGraphQL: CreateHandler = (appState: AppState) => async (req, res) => {
  const errParams = await getGraphQLParams(req)

  if (isLeft(errParams)) {
    return sendError(res, errParams.left)
  }

  const params = errParams.right

  if (typeof params.query !== 'string') {
    return sendError(res, createError(400, 'request.body json expected to have a query field'))
  }

  const source = new Source(params.query)

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
      variableValues: params.variables,
      // todo other options
    })
  } catch (error) {
    return sendError(res, createError(500, 'failed while resolving client request', { error }))
  }

  sendSuccess(res, result)
}

/**
 * Provided a "Request" provided by express or connect (typically a node style
 * HTTPClientRequest), Promise the GraphQL request parameters.
 */
async function getGraphQLParams(request: IncomingMessage): Promise<Either<HttpError, GraphQLParams>> {
  const bodyData = await parseBody(request)
  if (isLeft(bodyData)) return bodyData
  const urlData = (request.url && url.parse(request.url, true).query) || {}
  return parseGraphQLParams(urlData, bodyData.right)
}

/**
 * Helper function to get the GraphQL params from the request.
 */
function parseGraphQLParams(
  urlData: Record<string, unknown>,
  bodyData: Record<string, unknown>
): Either<HttpError, GraphQLParams> {
  let query: string | null
  const incomingQuery = urlData.query || bodyData.query

  if (typeof incomingQuery === 'string') {
    query = incomingQuery
  } else {
    query = null
  }

  let variables: null | Record<string, unknown>
  const incomingVariables = urlData.variables || bodyData.variables

  if (typeof incomingVariables === 'string') {
    try {
      variables = JSON.parse(incomingVariables)
    } catch (error) {
      return left(createError(400, 'Variables are invalid JSON.'))
    }
  } else if (typeof incomingVariables === 'object' && incomingVariables !== null) {
    variables = incomingVariables as Record<string, unknown>
  } else {
    variables = null
  }

  let operationName
  const incomingOperationName = urlData.operationName || bodyData.operationName

  if (typeof incomingOperationName === 'string') {
    operationName = incomingOperationName
  } else {
    operationName = null
  }

  const raw = urlData.raw !== undefined || bodyData.raw !== undefined

  return right({ query, variables, operationName, raw })
}
