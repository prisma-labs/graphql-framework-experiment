import nock from 'nock'
import { GraphQLClient } from './'

let client: GraphQLClient

beforeEach(() => {
  client = new GraphQLClient('http://foo.bar')
})

describe('headers', () => {
  it.each([
    [['a', 'b'], 'b', 'a'],
    [[['a', 'b']], 'b', 'a'],
    [[{ a: 'b' }], 'b', 'a'],
  ])('.set sets a header', (input, output, header) => {
    // @ts-ignore
    client.headers.set(...input)
    expect(client.headers.get(header)).toEqual(output)
  })

  it.each([
    [['a', 'b'], 'b, b', 'a'],
    [[['a', 'b']], 'b, b', 'a'],
    [[{ a: 'b' }], 'b, b', 'a'],
  ])('.adds adds to an existing a header', (input, output, header) => {
    // @ts-ignore
    client.headers.set(...input)
    // @ts-ignore
    client.headers.add(...input)
    expect(client.headers.get(header)).toEqual(output)
  })

  it('headers are sent with request', async () => {
    const nockreq = nock('http://foo.bar').post('/').matchHeader('foo', 'bar').reply(200, { data: {} })
    client.headers.set('foo', 'bar')
    await client.send('')
    nockreq.done()
  })
})
