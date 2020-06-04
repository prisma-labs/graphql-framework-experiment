import * as Client from './'

let client: Client.Client

beforeEach(() => {
  client = Client.create('foo.bar')
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
})
