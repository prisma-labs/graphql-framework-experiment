import { makeSchema, mutationType, queryType } from '@nexus/schema'
import { IncomingMessage, ServerResponse } from 'http'
import { Socket } from 'net'
import { createRequestHandlerGraphQL } from './handler-graphql'
import { NexusRequestHandler } from './server'

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
  reqBody(`{ foo }`)
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
    reqBody(`{ foo }`)
    await handler(req, res)
    expect(result(res)).toMatchInlineSnapshot(`
    "HTTP/1.1 500 InternalServerError
    Content-Type: application/json; charset=utf-8
    Content-Length: 150
    Date: __dynamic__
    Connection: close

    {\\"errors\\":[{\\"message\\":\\"Boolean cannot represent a non boolean value: \\\\\\"wrong type\\\\\\"\\",\\"locations\\":[{\\"line\\":1,\\"column\\":3}],\\"path\\":[\\"foo\\"]}],\\"data\\":null}"
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
    reqBody(`{ foo }`)
    await handler(req, res)
    expect(result(res)).toMatchInlineSnapshot(`
    "HTTP/1.1 500 InternalServerError
    Content-Type: application/json; charset=utf-8
    Content-Length: 94
    Date: __dynamic__
    Connection: close

    {\\"errors\\":[{\\"message\\":\\"oops\\",\\"locations\\":[{\\"line\\":1,\\"column\\":3}],\\"path\\":[\\"foo\\"]}],\\"data\\":null}"
  `)
  })
})

describe('client errors', () => {
  it('validates the query (e.g. selection set valid)', async () => {
    reqBody(`{ bad }`)
    await handler(req, res)
    expect(result(res)).toMatchInlineSnapshot(`
      "HTTP/1.1 400 BadRequestError
      Content-Type: application/json; charset=utf-8
      Content-Length: 97
      Date: __dynamic__
      Connection: close

      [{\\"message\\":\\"Cannot query field \\\\\\"bad\\\\\\" on type \\\\\\"Query\\\\\\".\\",\\"locations\\":[{\\"line\\":1,\\"column\\":3}]}]"
    `)
  })

  it('body query prop is required', async () => {
    reqBody({})
    await handler(req, res)
    expect(result(res)).toMatchInlineSnapshot(`
          "HTTP/1.1 400 BadRequestError
          Content-Type: application/json; charset=utf-8
          Content-Length: 62
          Date: __dynamic__
          Connection: close

          {\\"message\\":\\"request.body json expected to have a query field\\"}"
      `)
  })
  it('variables must be valid json', async () => {
    reqBody({ query: '{ foo }', variables: '' })
    await handler(req, res)
    expect(result(res)).toMatchInlineSnapshot(`
          "HTTP/1.1 400 BadRequestError
          Content-Type: application/json; charset=utf-8
          Content-Length: 41
          Date: __dynamic__
          Connection: close

          {\\"message\\":\\"Variables are invalid JSON.\\"}"
      `)
  })

  it('no mutation for GET', async () => {
    req.method = 'GET'
    reqBody({ query: 'mutation { foo }' })
    createHandler(
      mutationType({
        definition(t) {
          t.boolean('foo', () => false)
        },
      })
    )
    await handler(req, res)
    expect(result(res)).toMatchInlineSnapshot(`
          "HTTP/1.1 405 MethodNotAllowedError
          Allow: POST
          Content-Type: application/json; charset=utf-8
          Content-Length: 72
          Date: __dynamic__
          Connection: close

          {\\"message\\":\\"Can only perform a mutation operation from a POST request.\\"}"
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
    }
  )
}

function reqBody(params: string | { query?: string; variables?: string }): void {
  if (typeof params === 'string') {
    ;(req as any).body = {
      query: params,
    }
  } else {
    ;(req as any).body = params
  }
}

function result(res: ServerResponse): string {
  const output = (res as any).outputData ?? (res as any).output // node 10
  return output
    .reduce((data: string, outputDatum: any) => {
      if (outputDatum.data) {
        // node 12+
        data += String(outputDatum.data) //maybe buffer
      } else {
        data += String(outputDatum) // maybe buffer
      }
      return data
    }, '')
    .replace(/Date:.*/, 'Date: __dynamic__')
}
