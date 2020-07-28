import { makeSchema, queryType } from '@nexus/schema'
import { IncomingMessage, ServerResponse } from 'http'
import { Socket } from 'net'
import { createRequestHandlerGraphQL } from './handler-graphql'
import { NexusRequestHandler } from './server'
import { errorFormatter } from './error-formatter'

let handler: NexusRequestHandler
let socket: Socket
let req: IncomingMessage
let res: ServerResponse
let contextInput: any

beforeEach(() => {
  // todo actually use req body etc.
  contextInput = null
  socket = new Socket()
  req = new IncomingMessage(socket)
  res = new ServerResponse(req)
  createHandler(
    queryType({
      definition(t) {
        t.boolean('foo', () => false)
      },
    })
  )
})

it('passes the request and response to the schema context', async () => {
  reqPOST(`{ foo }`)

  await handler(req, res)

  expect(contextInput.req).toBeInstanceOf(IncomingMessage)
  expect(contextInput.res).toBeInstanceOf(ServerResponse)
})

/**
 * helpers
 */

function createHandler(...types: any) {
  handler = createRequestHandlerGraphQL(
    makeSchema({
      outputs: false,
      types,
    }),
    (params) => {
      contextInput = params

      return params
    },
    {
      introspection: true,
      errorFormatterFn: errorFormatter,
      path: '/graphql',
      playground: false,
    }
  )
}

function reqPOST(params: string | { query?: string; variables?: string }): void {
  req.method = 'POST'
  if (typeof params === 'string') {
    ;(req as any).body = {
      query: params,
    }
  } else {
    ;(req as any).body = params
  }
}
