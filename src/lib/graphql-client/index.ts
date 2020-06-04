import { Headers } from 'cross-fetch'
import * as GQLR from 'graphql-request'

export type Client = {
  send: GQLR.GraphQLClient['request']
  headers: {
    set(headers: Record<string, string>): void
    set(name: string, value: string): void
    set(header: [string, string]): void
    add(headers: Record<string, string>): void
    add(name: string, value: string): void
    add(header: [string, string]): void
    del(name: string): void
    get(name: string): null | string
    has(name: string): boolean
    entries(): IterableIterator<[string, string]>
  }
}

/**
 * Create a GraphQL Client instance
 */
export function create(apiUrl: string): Client {
  const headers = new Headers()

  return {
    send(queryString: string, variables) {
      const client = new GQLR.GraphQLClient(apiUrl, { headers })
      return client.request(queryString, variables)
    },
    headers: {
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
          headers.set(k, v)
        })

        return undefined
      },
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
          headers.append(name, value)
        })

        return undefined
      },
      del: headers.delete.bind(headers),
      get: headers.get.bind(headers),
      has: headers.has.bind(headers),
      entries: headers.entries.bind(headers),
    },
  }
}
