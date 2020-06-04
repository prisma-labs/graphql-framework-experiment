import { Headers } from 'cross-fetch'
import * as GQLR from 'graphql-request'

type GraphQLClient = {
  send: GQLR.GraphQLClient['request']
  headers: {
    get: Headers['get']
    /**
     * Acceptable instance-manipulations for the request.
     *
     * @example
     *
     * ```ts
     * set('A-IM', 'fee')
     * ```
     *
     * @remarks
     *
     * [RFC 3229](https://tools.ietf.org/html/rfc3229)
     */
    set(name: 'A-IM', value: string): void
    /**
     * Media type(s) that is/are acceptable for the response. See Content negotiation.
     *
     * @example
     *
     * ```ts
     * set('Accept', 'text/html')
     * ```
     *
     * @remarks
     *
     * [RFC 2616](https://tools.ietf.org/html/rfc2616)
     * [RFC 7231](https://tools.ietf.org/html/rfc7231)
     */
    set(name: 'Accept', value: string): void
    /**
     * The Accept-Charset request-header field can be used to indicate what character sets are acceptable for the response. This field allows clients capable of understanding more comprehensive or special- purpose character sets to signal that capability to a server which is capable of representing documents in those character sets.
     *
     * @example
     *
     * ```ts
     * set('Accept-Charset', 'utf-8')
     * ```
     *
     * @remarks
     *
     * [RFC 2616](https://tools.ietf.org/html/rfc2616)
     */
    set(
      name: 'Accept-Charset',
      value: {
        /**
         * Name of the character set.
         */
        charset: string
        /**
         * represents the user's preference for that charset. The default value is 1
         *
         * @example
         *
         * 2
         */
        quality?: number
      }
    ): void
    set(name: string, value: string): void
    // set: Headers['set']
    has: Headers['has']
    delete: Headers['delete']
    append: Headers['append']
    entries: Headers['entries']
  }
}

/**
 * Create a GraphQL Client instance
 */
export function create(apiUrl: string): GraphQLClient {
  const headers = new Headers()

  return {
    send(queryString: string, variables) {
      const client = new GQLR.GraphQLClient(apiUrl, { headers })
      return client.request(queryString, variables)
    },
    headers: {
      get: headers.get.bind(headers),
      set: headers.set.bind(headers),
      has: headers.has.bind(headers),
      append: headers.append.bind(headers),
      delete: headers.delete.bind(headers),
      entries: headers.entries.bind(headers),
    },
  }
}

// playground

const c = create('abc.com')
c.headers.set('x-resposne-time', '123')
c.headers.set()
c.headers.append('abc', '4')
;[...c.headers.entries()] //?
