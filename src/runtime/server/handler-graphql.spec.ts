import { makeSchema, mutationType, queryType } from '@nexus/schema'
import { IncomingMessage, ServerResponse } from 'http'
import { Socket } from 'net'
import { createRequestHandlerGraphQL } from './handler-graphql'
import { NexusRequestHandler } from './server'
import { errorFormatter } from './error-formatter'

let handler: NexusRequestHandler
let socket: Socket
let req: IncomingMessage
let res: ServerResponse

beforeEach(() => {
  // todo actually use req body etc.
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

it('resolves a request', async () => {
  reqPOST(`{ foo }`)
  await handler(req, res)
  expect(result(res)).toMatchInlineSnapshot(`
    "HTTP/1.1 200 Success
    Content-Type: application/json; charset=utf-8
    Content-Length: 22
    Date: __dynamic__
    Connection: close

    {\\"data\\":{\\"foo\\":false}}"
  `)
})

describe('internal errors', () => {
  it('Handles response data type errors', async () => {
    createHandler(
      queryType({
        definition(t) {
          t.boolean('foo', () => {
            return 'wrong type'
          })
        },
      })
    )
    reqPOST(`{ foo }`)
    await handler(req, res)
    expect(result(res)).toMatchInlineSnapshot(`
      "HTTP/1.1 200 Success
      Content-Type: application/json; charset=utf-8
      Content-Length: 196
      Date: __dynamic__
      Connection: close

      {\\"errors\\":[{\\"message\\":\\"Boolean cannot represent a non boolean value: \\\\\\"wrong type\\\\\\"\\",\\"locations\\":[{\\"line\\":1,\\"column\\":3}],\\"path\\":[\\"foo\\"],\\"extensions\\":{\\"code\\":\\"INTERNAL_SERVER_ERROR\\"}}],\\"data\\":null}"
    `)
  })
  it('Handles throw errors in resolvers', async () => {
    createHandler(
      queryType({
        definition(t) {
          t.boolean('foo', () => {
            throw new Error('oops')
          })
        },
      })
    )
    reqPOST(`{ foo }`)
    await handler(req, res)
    expect(result(res)).toMatchInlineSnapshot(`
      "HTTP/1.1 200 Success
      Content-Type: application/json; charset=utf-8
      Content-Length: 140
      Date: __dynamic__
      Connection: close

      {\\"errors\\":[{\\"message\\":\\"oops\\",\\"locations\\":[{\\"line\\":1,\\"column\\":3}],\\"path\\":[\\"foo\\"],\\"extensions\\":{\\"code\\":\\"INTERNAL_SERVER_ERROR\\"}}],\\"data\\":null}"
    `)
  })
})

describe('client errors', () => {
  it('validates the query (e.g. selection set valid)', async () => {
    reqPOST(`{ bad }`)
    await handler(req, res)
    expect(result(res)).toMatchInlineSnapshot(`
      "HTTP/1.1 400 HttpQueryError
      Content-Type: application/json; charset=utf-8
      Content-Length: 158
      Date: __dynamic__
      Connection: close

      {\\"errors\\":[{\\"message\\":\\"Cannot query field \\\\\\"bad\\\\\\" on type \\\\\\"Query\\\\\\".\\",\\"locations\\":[{\\"line\\":1,\\"column\\":3}],\\"extensions\\":{\\"code\\":\\"GRAPHQL_VALIDATION_FAILED\\"}}]}"
    `)
  })

  it('body query prop is required', async () => {
    reqPOST({})
    await handler(req, res)
    expect(result(res)).toMatchInlineSnapshot(`
      "HTTP/1.1 500 HttpQueryError
      Content-Type: application/json; charset=utf-8
      Content-Length: 75
      Date: __dynamic__
      Connection: close

      {\\"message\\":\\"POST body missing. Did you forget use body-parser middleware?\\"}"
    `)
  })
  it('variables must be valid json', async () => {
    reqPOST({ query: '{ foo }', variables: '' })
    await handler(req, res)
    expect(result(res)).toMatchInlineSnapshot(`
      "HTTP/1.1 400 HttpQueryError
      Content-Type: application/json; charset=utf-8
      Content-Length: 214
      Date: __dynamic__
      Connection: close

      {\\"errors\\":[{\\"message\\":\\"Variables must be provided as an Object where each property is a variable value. Perhaps look to see if an unparsed JSON string was provided.\\",\\"extensions\\":{\\"code\\":\\"INTERNAL_SERVER_ERROR\\"}}]}"
    `)
  })

  it('no mutation for GET', async () => {
    reqGET({ query: 'mutation { foo }' })
    createHandler(
      mutationType({
        definition(t) {
          t.boolean('foo', () => false)
        },
      })
    )
    await handler(req, res)
    expect(result(res)).toMatchInlineSnapshot(`
      "HTTP/1.1 405 HttpQueryError
      Allow: POST
      Content-Type: application/json; charset=utf-8
      Content-Length: 47
      Date: __dynamic__
      Connection: close

      {\\"message\\":\\"GET supports only query operation\\"}"
    `)
  })
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
    () => {
      return {}
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

function reqGET(params: { query?: string; variables?: string }): void {
  req.method = 'GET'
  req.url = `http://localhost:4000/graphql?${new URLSearchParams({
    query: params.query ?? '',
    variables: params.variables ?? '',
  }).toString()}`
}

function result(res: ServerResponse): string {
  const output = (res as any).outputData ?? (res as any).output // node 10
  return output
    .reduce((data: string, outputDatum: any) => {
      if (outputDatum.data !== undefined) {
        // node 12+
        data += String(outputDatum.data) //maybe buffer
      } else {
        data += String(outputDatum) // maybe buffer
      }
      return data
    }, '')
    .replace(/Date:.*/, 'Date: __dynamic__')
}
