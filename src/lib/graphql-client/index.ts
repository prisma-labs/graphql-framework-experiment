import { Headers as FetchHeaders } from 'cross-fetch'
import * as GQLR from 'graphql-request'
import { Param3 } from '../utils'

type Variables = Omit<Param3<typeof GQLR.request>, 'undefined'>

type FetchHeaders = typeof FetchHeaders['prototype']

export class GraphQLClient {
  private fetchHeaders: FetchHeaders
  public headers: Headers

  constructor(private url: string) {
    this.fetchHeaders = new FetchHeaders()
    this.headers = new Headers(this.fetchHeaders)
  }

  send(queryString: string, variables?: Variables) {
    let headers = fetchHeadersToObject(this.fetchHeaders)
    const url = this.url
    const client = new GQLR.GraphQLClient(url, { headers })
    return client.request(queryString, variables)
  }
}

/**
 * Create a GraphQL Client instance
 */
export class Headers {
  constructor(private fetchHeaders: FetchHeaders) {}

  set(headers: Record<string, string>): void
  set(name: string, value: string): void
  set(header: [string, string]): void
  set(...args: unknown[]) {
    let input: Record<string, string>
    if (Array.isArray(args[0])) {
      input = { [args[0][0]]: args[0][1] }
    } else if (typeof args[0] === 'string' && typeof args[1] === 'string') {
      input = { [args[0]]: args[1] }
    } else if (typeof args[0] === 'object' && args[0] !== null) {
      input = args[0] as any
    } else throw new TypeError(`invalid input: ${args}`)

    Object.entries(input).forEach(([k, v]) => {
      this.fetchHeaders.set(k, v)
    })

    return undefined
  }
  add(headers: Record<string, string>): void
  add(name: string, value: string): void
  add(header: [string, string]): void
  add(...args: any[]) {
    let input: Record<string, string>
    if (Array.isArray(args[0])) {
      input = { [args[0][0]]: args[0][1] }
    } else if (typeof args[0] === 'string' && typeof args[1] === 'string') {
      input = { [args[0]]: args[1] }
    } else if (typeof args[0] === 'object') {
      input = args[0]
    } else throw new TypeError(`invalid input: ${args}`)

    Object.entries(input).forEach(([name, value]) => {
      this.fetchHeaders.append(name, value)
    })

    return undefined
  }
  del(name: string) {
    return this.fetchHeaders.delete(name)
  }
  get(name: string) {
    return this.fetchHeaders.get(name)
  }
  has(name: string) {
    return this.fetchHeaders.has(name)
  }
  entries() {
    return this.fetchHeaders.entries()
  }
}

/**
 * Convert fetch headers to plain object.
 */
function fetchHeadersToObject(headers: globalThis.Headers): Record<string, string> {
  let obj: Record<string, string> = {}
  for (const [name, value] of headers.entries()) {
    obj[name] = value
  }
  return obj
}
