import { Either, isLeft, left, right, toError, tryCatch } from 'fp-ts/lib/Either'
import { execute, getOperationAST, GraphQLSchema, parse, Source, validate } from 'graphql'
import { IncomingMessage } from 'http'
import createError, { HttpError } from 'http-errors'
import url from 'url'
import { parseBody } from './parse-body'
import { ContextCreator, NexusRequestHandler } from './server'
import { sendError, sendErrorData, sendSuccess } from './utils'

type CreateHandler = (schema: GraphQLSchema, createContext: ContextCreator) => NexusRequestHandler

type GraphQLParams = {
  query: null | string
  variables: null | Record<string, unknown>
  operationName: null | string
  raw: boolean
}

/**
 * Create a handler for graphql requests.
 */
export const createRequestHandlerGraphQL: CreateHandler = (schema, createContext) => async (req, res) => {
  const errParams = await getGraphQLParams(req)

  if (isLeft(errParams)) {
    return sendError(res, errParams.left)
  }

  const params = errParams.right

  if (typeof params.query !== 'string') {
    return sendError(res, createError(400, 'request.body json expected to have a query field'))
  }

  const source = new Source(params.query)

  const errDocumentAST = tryCatch(() => parse(source), toError)

  if (isLeft(errDocumentAST)) {
    return sendError(res, createError(400, errDocumentAST.left))
  }

  const documentAST = errDocumentAST.right

  const validationFailures = validate(schema, documentAST)

  if (validationFailures.length > 0) {
    // todo lots of rich info for clients in here, expose it to them
    return sendErrorData(
      res,
      createError(400, 'GraphQL operation validation failed', { data: validationFailures })
    )
  }

  // Only query operations are allowed on GET requests.
  if (req.method === 'GET') {
    const operationAST = getOperationAST(documentAST, params.operationName)
    if (operationAST && operationAST.operation !== 'query') {
      res.setHeader('Allow', 'POST')
      return sendError(
        res,
        createError(405, `Can only perform a ${operationAST.operation} operation from a POST request.`)
      )
    }
  }

  const context = await createContext(req)

  const result = await execute({
    schema: schema,
    document: documentAST,
    contextValue: context,
    variableValues: params.variables,
    operationName: params.operationName,
  })

  if (result.errors) {
    return sendErrorData(res, createError(500, 'failed while resolving client request', { data: result }))
  }

  return sendSuccess(res, result)
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
