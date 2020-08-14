import * as S from '..'

it('can have their settings changed', () => {
  const s = S.create<{ a: R<{ b: number }> }>({ fields: { a: { entry: { fields: { b: {} } } } } })
  expect(s.change({ a: { foobar: { b: 2 } } }).data).toEqual({ a: { foobar: { b: 2 } } })
})

describe('initial()', () => {
  it('is accepted and is called (required record case)', () => {
    // prettier-ignore
    const s = S.create<{ a: R<{ b: number }> }>({ fields: { a: { initial: () => ({ foobar: { b: 2 } }), entry: { fields: { b: {} } } } } })
    expect(s.data).toEqual({ a: { foobar: { b: 2 } } })
    expect(s.metadata).toMatchInlineSnapshot(`
        Object {
          "fields": Object {
            "a": Object {
              "from": "initial",
              "initial": Object {
                "foobar": Object {
                  "fields": Object {
                    "b": Object {
                      "from": "initial",
                      "initial": 2,
                      "type": "leaf",
                      "value": 2,
                    },
                  },
                  "type": "namespace",
                },
              },
              "type": "record",
              "value": Object {
                "foobar": Object {
                  "fields": Object {
                    "b": Object {
                      "from": "initial",
                      "initial": 2,
                      "type": "leaf",
                      "value": 2,
                    },
                  },
                  "type": "namespace",
                },
              },
            },
          },
          "type": "namespace",
        }
      `)
  })
  it('is accepted and is called (optional record case)', () => {
    // prettier-ignore
    const s = S.create<{ a?: R<{ b: number }> }>({ fields: { a: { initial: () => ({ foobar: {b:2}}), entry: { fields: { b: {} } } } } })
    expect(s.data).toEqual({ a: { foobar: { b: 2 } } })
    expect(s.metadata).toMatchInlineSnapshot(`
        Object {
          "fields": Object {
            "a": Object {
              "from": "initial",
              "initial": Object {
                "foobar": Object {
                  "fields": Object {
                    "b": Object {
                      "from": "initial",
                      "initial": 2,
                      "type": "leaf",
                      "value": 2,
                    },
                  },
                  "type": "namespace",
                },
              },
              "type": "record",
              "value": Object {
                "foobar": Object {
                  "fields": Object {
                    "b": Object {
                      "from": "initial",
                      "initial": 2,
                      "type": "leaf",
                      "value": 2,
                    },
                  },
                  "type": "namespace",
                },
              },
            },
          },
          "type": "namespace",
        }
      `)
  })
  it('is omittable, defaulting to empty object (optional reocrd case)', () => {
    // todo bit odd that data could be typed as optional but it would never be...
    // prettier-ignore
    const s = S.create<{ a?: R<{ b: number }> }>({ fields: { a: { entry: { fields: { b: {} } } } } })
    expect(s.data).toEqual({ a: {} })
    expect(s.metadata).toEqual({
      type: 'namespace',
      fields: {
        a: {
          type: 'record',
          from: 'initial',
          value: {},
          initial: {},
        },
      },
    })
  })
  describe('metadata', () => {
    it('captured immutable initial state', () => {
      const s = S.create<{ a?: R<{ b: number }> }>({ fields: { a: { entry: { fields: { b: {} } } } } })
      s.change({ a: { foobar: { b: 1 } } })
      expect(s.metadata).toEqual({
        type: 'namespace',
        fields: {
          a: {
            type: 'record',
            from: 'initial', // todo set
            value: {
              foobar: {
                type: 'namespace',
                fields: { b: { type: 'leaf', value: 1, from: 'set', initial: undefined } },
              },
            },
            initial: {},
          },
        },
      })
    })
    it('captures immutable initial state even with sub-initializers', () => {
      // prettier-ignore
      const s = S.create<{ a: R<{ b?: number; c?: number }> }>({
          fields: { a: { initial: () => ({ foobar: { c: 1 } }), entry: { fields: { c: { initial: () => 100 }, b: { initial: () => 2 } } } } }
        })
      expect(s.metadata).toMatchSnapshot()
      s.change({ a: { foobar: { c: 3 } } })
      expect(s.metadata).toMatchSnapshot()
    })
  })
  describe('sub-initializers', () => {
    it('run when respective fields not given by record initializer', () => {
      const s = S.create<{ a: R<{ b?: number }> }>({
        fields: { a: { initial: () => ({ foobar: {} }), entry: { fields: { b: { initial: () => 1 } } } } },
      })
      expect(s.data).toEqual({ a: { foobar: { b: 1 } } })
    })
    it('skipped when respective fields are given by record initializer', () => {
      // prettier-ignore
      const s = S.create<{ a: R<{ b?: number }> }>({
          fields: { a: { initial: () => ({ foobar: { b: 2 } }), entry: { fields: { b: { initial: () => 1 } } } } },
        })
      expect(s.data).toEqual({ a: { foobar: { b: 2 } } })
    })
    it('data merged with data given in record initializer', () => {
      // prettier-ignore
      const s = S.create<{ a: R<{ b?: number; c: 1 }> }>({
          fields: { a: { initial: () => ({ foobar: { c: 1 } }), entry: { fields: { c: {}, b: { initial: () => 1 } } } } }
        })
      expect(s.data).toEqual({ a: { foobar: { c: 1, b: 1 } } })
    })
  })
})
describe('mapEntryType', () => {
  it.todo('required if the entry input type does not match data type')
})
describe('mapEntryData', () => {
  it('required if the entry input field name does not match any data field name; called if given', () => {
    // prettier-ignore
    const s = S.create<{ a?: R<{ a?: number }> }, { a: R<{ a: number, b: number }> }>({
        fields: { a: {  mapEntryData: (data) => ({ a: data.a, b: data.a }), entry: { fields: { a: { initial: () => 1 } } } } }
      })
    s.change({ a: { foobar: { a: 1 } } })
    expect(s.data).toEqual({ a: { foobar: { a: 1, b: 1 } } })
  })
  it('passes key name to callback as second parameter', () => {
    let keyName_
    // prettier-ignore
    const s = S.create<{ a?: R<{ a?: number }> }, { a: R<{ a: number, b: number }> }>({
        fields: { a: { mapEntryData: (data, keyName) => (keyName_ = keyName, { a: data.a, b: data.a }), entry: { fields: { a: { initial: () => 1 } } } } }
      })
    s.change({ a: { foobar: { a: 1 } } })
    expect(keyName_).toEqual('foobar')
  })
  it('runs at initialization time', () => {
    // prettier-ignore
    const s = S.create<{ a?: R<{ a?: number }> }, { a: R<{ a: number, b: number }> }>({
        fields: { a: { mapEntryData: (data) => ({ a: data.a, b: data.a }), initial: () => ({ foobar: { a: 1 } }), entry: { fields: { a: { initial: () => 1 } } } } }
      })
    expect(s.data).toEqual({ a: { foobar: { a: 1, b: 1 } } })
  })
  it('metadata considers source of contribution as being "initial" (instead of e.g. "set") and immutable as usual', () => {
    // prettier-ignore
    const s = S.create<{ a?: R<{ a?: number }> }, { a: R<{ a: number, b: number }> }>({
        fields: { a: { mapEntryData: (data) => ({ a: data.a, b: data.a }), initial: () => ({ foobar: { a: 1 } }), entry: { fields: { a: { initial: () => 1 } } } } }
      })
    const metadataAInitial = s.metadata.fields.a.initial
    expect(s.metadata).toMatchInlineSnapshot(`
        Object {
          "fields": Object {
            "a": Object {
              "from": "initial",
              "initial": Object {
                "foobar": Object {
                  "fields": Object {
                    "a": Object {
                      "from": "initial",
                      "initial": 1,
                      "type": "leaf",
                      "value": 1,
                    },
                    "b": Object {
                      "from": "initial",
                      "initial": 1,
                      "isShadow": true,
                      "type": "leaf",
                      "value": 1,
                    },
                  },
                  "type": "namespace",
                },
              },
              "type": "record",
              "value": Object {
                "foobar": Object {
                  "fields": Object {
                    "a": Object {
                      "from": "initial",
                      "initial": 1,
                      "type": "leaf",
                      "value": 1,
                    },
                    "b": Object {
                      "from": "initial",
                      "initial": 1,
                      "isShadow": true,
                      "type": "leaf",
                      "value": 1,
                    },
                  },
                  "type": "namespace",
                },
              },
            },
          },
          "type": "namespace",
        }
      `)
    s.change({ a: { foobar: { a: 2 } } })
    expect(s.metadata.fields.a.initial).toEqual(metadataAInitial)
  })
})
describe('entryShorthand', () => {
  it.todo('can be provided to allow shorthands on entries (like namespaces)')
})

/**
 * Helpers
 */

/**
 * Create a constant function
 */
const c = <T>(x: T) => () => x

/**
 * Create a string-keyed record
 */
type R<T> = Record<string, T>
