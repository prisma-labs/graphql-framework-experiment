import { OutgoingHttpHeaders, ServerResponse } from 'http'
import { HttpError } from 'http-errors'

type MimeType = 'text/html' | 'application/json'

export function sendSuccess(res: ServerResponse, data: object): void {
  sendJSON(res, 200, 'Success', {}, data)
}

export function sendErrorData(res: ServerResponse, e: HttpError): void {
  ;(res as any).error = e
  sendJSON(res, e.status, e.name, e.headers ?? {}, e.graphqlErrors)
}

export function sendError(res: ServerResponse, e: HttpError): void {
  ;(res as any).error = e
  sendJSON(res, e.status, e.name, e.headers ?? {}, { message: e.message })
}

export function sendJSON(
  res: ServerResponse,
  status: number,
  statusMessage: string,
  headers: OutgoingHttpHeaders,
  data: object
): void {
  res.statusCode = status
  res.statusMessage = statusMessage
  Object.entries(headers).forEach(([k, v]) => {
    if (v !== undefined) {
      res.setHeader(k, v)
    }
  })
  sendResponse(res, 'application/json', JSON.stringify(data))
}

/**
 * Helper function for sending a response using only the core Node server APIs.
 */
export function sendResponse(res: ServerResponse, type: MimeType, data: string): void {
  const chunk = Buffer.from(data, 'utf8')
  res.setHeader('Content-Type', `${type}; charset=utf-8`)
  res.setHeader('Content-Length', String(chunk.length))
  res.end(chunk)
}
