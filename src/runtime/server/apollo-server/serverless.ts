import { renderPlaygroundPage } from '@apollographql/graphql-playground-html'
import accepts from 'accepts'
import {
  ApolloServerBase,
  convertNodeHttpToRequest,
  GraphQLOptions,
  HttpQueryError,
  processFileUploads,
  runHttpQuery,
} from 'apollo-server-core'
import { isLeft, right } from 'fp-ts/lib/Either'
import { IncomingMessage, ServerResponse } from 'http'
import createError from 'http-errors'
import { parseBody, parseQuery } from '../parse-body'
import { sendError, sendJSON, sendResponse } from '../utils'
import { NexusRequestHandler } from '../server'
import { ApolloConfig } from './types'

export interface ServerRegistration {
  path?: string
  disableHealthCheck?: boolean
  onHealthCheck?: (req: IncomingMessage) => Promise<any>
}

export class ApolloServerless extends ApolloServerBase {
  constructor(config: ApolloConfig) {
    super(config)
  }

  // Extract Apollo Server options from the request.
  async createGraphQLServerOptions(req: IncomingMessage, res: ServerResponse): Promise<GraphQLOptions> {
    return super.graphQLServerOptions({ req, res })
  }

  // Prepares and returns an async function that can be used by Micro to handle
  // GraphQL requests.
  public createHandler({ path, disableHealthCheck, onHealthCheck }: ServerRegistration = {}) {
    // We'll kick off the `willStart` right away, so hopefully it'll finish
    // before the first request comes in.
    const promiseWillStart = this.willStart()

    return async (req: IncomingMessage, res: ServerResponse) => {
      this.graphqlPath = path || '/graphql'

      await promiseWillStart

      if (typeof processFileUploads === 'function') {
        await this.handleFileUploads(req, res)
      }

      if (this.isHealthCheckRequest(req, disableHealthCheck)) {
        return this.handleHealthCheck({
          req,
          res,
          onHealthCheck,
        })
      }

      if (this.isPlaygroundRequest(req)) {
        return this.handleGraphqlRequestsWithPlayground({ req, res })
      }

      return this.handleGraphqlRequestsWithServer({ req, res })
    }
  }

  // This integration supports file uploads.
  protected supportsUploads(): boolean {
    return true
  }

  // This integration supports subscriptions.
  protected supportsSubscriptions(): boolean {
    return false
  }

  private isHealthCheckRequest(req: IncomingMessage, disableHealthCheck?: boolean) {
    return !disableHealthCheck && req.url === '/.well-known/apollo/server-health'
  }

  private isPlaygroundRequest(req: IncomingMessage) {
    const playgroundEnabled = Boolean(this.playgroundOptions) && req.method === 'GET'
    const acceptTypes = accepts(req).types() as string[]
    const prefersHTML =
      acceptTypes.find((x: string) => x === 'text/html') === 'text/html'

    return playgroundEnabled && prefersHTML
  }

  // If health checking is enabled, trigger the `onHealthCheck`
  // function when the health check URL is requested.
  private async handleHealthCheck({
    req,
    res,
    onHealthCheck,
  }: {
    req: IncomingMessage
    res: ServerResponse
    onHealthCheck?: (req: IncomingMessage) => Promise<any>
  }): Promise<void> {
    // Response follows
    // https://tools.ietf.org/html/draft-inadarei-api-health-check-01
    res.setHeader('Content-Type', 'application/health+json')

    if (onHealthCheck) {
      try {
        await onHealthCheck(req)
      } catch (error) {
        sendJSON(res, 503, 'Service Unavailable', {}, { status: 'fail' })
        return
      }
    }

    sendJSON(res, 200, 'Success', {}, { status: 'pass' })
  }

  // If the `playgroundOptions` are set, register a `graphql-playground` instance
  // (not available in production) that is then used to handle all
  // incoming GraphQL requests.
  private handleGraphqlRequestsWithPlayground({
    req,
    res,
  }: {
    req: IncomingMessage
    res: ServerResponse
  }): void {
    const middlewareOptions = {
      endpoint: this.graphqlPath,
      subscriptionEndpoint: this.subscriptionsPath,
      ...this.playgroundOptions,
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.statusCode = 200
    res.statusMessage = 'Success'
    sendResponse(res, 'text/html', renderPlaygroundPage(middlewareOptions))
  }

  // Handle incoming GraphQL requests using Apollo Server.
  private async handleGraphqlRequestsWithServer({
    req,
    res,
  }: {
    req: IncomingMessage
    res: ServerResponse
  }): Promise<void> {
    const handler = graphqlHandler(() => {
      return this.createGraphQLServerOptions(req, res)
    })

    await handler(req, res)
  }

  // If file uploads are detected, prepare them for easier handling with
  // the help of `graphql-upload`.
  private async handleFileUploads(req: IncomingMessage, res: ServerResponse) {
    if (typeof processFileUploads !== 'function') {
      return
    }

    const contentType = req.headers['content-type']
    if (this.uploadsConfig && contentType && contentType.startsWith('multipart/form-data')) {
      ;(req as any).filePayload = await processFileUploads(req, res, this.uploadsConfig)
    }
  }
}

// Utility function used to set multiple headers on a response object.
function setHeaders(res: ServerResponse, headers: Record<string, string>): void {
  Object.keys(headers).forEach((header: string) => {
    res.setHeader(header, headers[header])
  })
}

export interface NexusGraphQLOptionsFunction {
  (req: IncomingMessage, res: ServerResponse): GraphQLOptions | Promise<GraphQLOptions>
}

// Build and return an async function that passes incoming GraphQL requests
// over to Apollo Server for processing, then fires the results/response back
// using Micro's `send` functionality.
export function graphqlHandler(options: NexusGraphQLOptionsFunction): NexusRequestHandler {
  if (!options) {
    throw new Error('Apollo Server requires options.')
  }

  if (arguments.length > 1) {
    throw new Error(`Apollo Server expects exactly one argument, got ${arguments.length}`)
  }

  return async (req: IncomingMessage, res: ServerResponse) => {
    try {
      if (req.method !== 'GET' && req.method !== 'POST') {
        return sendError(res, createError(400, 'Only GET and POST requests allowed'))
      }

      const query =
        req.method === 'POST'
          ? (req as any).filePayload
            ? right((req as any).filePayload)
            : await parseBody(req)
          : parseQuery(req)

      if (isLeft(query)) {
        return sendError(res, query.left)
      }

      const { graphqlResponse, responseInit } = await runHttpQuery([req, res], {
        method: req.method ?? 'GET',
        options,
        query: query.right,
        request: convertNodeHttpToRequest(req),
      })

      setHeaders(res, responseInit.headers ?? {})

      sendJSON(res, 200, 'Success', {}, JSON.parse(graphqlResponse))
    } catch (error) {
      if ('HttpQueryError' !== error.name) {
        throw error
      }

      const e = error as HttpQueryError

      res.statusCode = e.statusCode ?? 500
      res.statusMessage = e.name

      if (e.isGraphQLError) {
        sendJSON(res, res.statusCode, res.statusMessage, e.headers ?? {}, JSON.parse(e.message))
      } else {
        sendJSON(res, res.statusCode, res.statusMessage, e.headers ?? {}, { message: e.message })
      }
    }
  }
}
