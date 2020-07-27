/**
 * This module is copy-pasted & adapted from https://github.com/graphql/express-graphql/blob/master/src/parseBody.js
 */
import contentType, { ParsedMediaType } from 'content-type'
import { Either, isLeft, left, right } from 'fp-ts/lib/Either'
import { IncomingMessage } from 'http'
import httpError, { HttpError } from 'http-errors'
import querystring, { ParsedUrlQuery } from 'querystring'
import getBody from 'raw-body'
import * as url from 'url'
import zlib, { Gunzip } from 'zlib'

export function parseQuery(request: IncomingMessage): Either<HttpError, ParsedUrlQuery> {
  const urlData = (request.url && url.parse(request.url, true).query) || {}

  return right(urlData)
}

/**
 * Provided a "Request" provided by express or connect (typically a node style
 * HTTPClientRequest), Promise the body data contained.
 */
export async function parseBody(req: IncomingMessage): Promise<Either<HttpError, Record<string, unknown>>> {
  const { body } = req as any

  // If express has already parsed a body as a keyed object, use it.
  if (typeof body === 'object' && !(body instanceof Buffer)) {
    return right(body)
  }

  // Skip requests without content types.
  if (req.headers['content-type'] === undefined) {
    return right({})
  }

  const typeInfo = contentType.parse(req)

  // If express has already parsed a body as a string, and the content-type
  // was application/graphql, parse the string body.
  if (typeof body === 'string' && typeInfo.type === 'application/graphql') {
    return right({ query: body })
  }

  // Already parsed body we didn't recognise? Parse nothing.
  if (body != null) {
    return right({})
  }

  const rawBody = await readBody(req, typeInfo)

  if (isLeft(rawBody)) return rawBody

  // Use the correct body parser based on Content-Type header.
  switch (typeInfo.type) {
    case 'application/graphql':
      return right({ query: rawBody.right })
    case 'application/json':
      if (jsonObjRegex.test(rawBody.right)) {
        try {
          return right(JSON.parse(rawBody.right))
        } catch (error) {
          // Do nothing
        }
      }
      return left(httpError(400, 'POST body sent invalid JSON.'))
    case 'application/x-www-form-urlencoded':
      return right(querystring.parse(rawBody.right))
  }

  // If no Content-Type header matches, parse nothing.
  return right({})
}

/**
 * RegExp to match an Object-opening brace "{" as the first non-space
 * in a string. Allowed whitespace is defined in RFC 7159:
 *
 *     ' '   Space
 *     '\t'  Horizontal tab
 *     '\n'  Line feed or New line
 *     '\r'  Carriage return
 */
const jsonObjRegex = /^[ \t\n\r]*\{/

// Read and parse a request body.
async function readBody(req: IncomingMessage, typeInfo: ParsedMediaType): Promise<Either<HttpError, string>> {
  const charset = (typeInfo.parameters.charset || 'utf-8').toLowerCase()

  // Assert charset encoding per JSON RFC 7159 sec 8.1
  if (charset.slice(0, 4) !== 'utf-') {
    return left(httpError(415, `Unsupported charset "${charset.toUpperCase()}".`))
  }

  // Get content-encoding (e.g. gzip)
  const contentEncoding = req.headers['content-encoding']
  const encoding = typeof contentEncoding === 'string' ? contentEncoding.toLowerCase() : 'identity'
  const length = encoding === 'identity' ? req.headers['content-length'] : null
  const limit = 100 * 1024 // 100kb
  const stream = decompressed(req, encoding)

  if (isLeft(stream)) return stream

  // Read body from stream.
  try {
    const body = await getBody(stream.right, { encoding: charset, length, limit })
    return right(body)
  } catch (err) {
    return err.type === 'encoding.unsupported'
      ? left(httpError(415, `Unsupported charset "${charset.toUpperCase()}".`))
      : left(httpError(400, `Invalid body: ${err.message}.`))
  }
}

/**
 * Return a decompressed stream, given an encoding.
 */
function decompressed(req: IncomingMessage, encoding: string): Either<HttpError, IncomingMessage | Gunzip> {
  switch (encoding) {
    case 'identity':
      return right(req)
    case 'deflate':
      return right(req.pipe(zlib.createInflate()))
    case 'gzip':
      return right(req.pipe(zlib.createGunzip()))
  }
  return left(httpError(415, `Unsupported content-encoding "${encoding}".`))
}
