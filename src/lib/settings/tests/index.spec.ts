import { log } from '@nexus/logger'
import dedent from 'dedent'
import 'jest-extended'
import * as Lo from 'lodash'
import * as tsd from 'tsd'
import * as S from '..'

describe('input field specifiers', () => {
  it('make it possible to manage a setting', () => {
    const s = S.create<{ a: string }>({ fields: { a: {} } })
    expect(s.change({ a: 'a2' }).data).toEqual({ a: 'a2' })
  })
  describe('encounter static errors', () => {
    it('if missing for a fields in the input type', () => {
      S.create<{ a: number }>({ fields: { a: {} } })
      // @ts-expect-error
      S.create<{ a: number }>({ fields: {} })
    })
  })
  describe('with optional data type', () => {
    it('can be omitted', () => {
      const s = S.create<{ a: number }, { a?: number }>({ fields: {} })
      expect(s.data.a).toBeUndefined()
    })
    it('can still be provided too', () => {
      const s = S.create<{ a: number }, { a?: number }>({ fields: { a: {} } })
      expect(s.data.a).toBeUndefined()
    })
  })
  it('can be omitted when input+data is optional', () => {
    // prettier-ignore
    const s = S.create<{ a?: number }, { a?: number }>({ fields: {} })
    s.change({ a: 1 })
    expect(s.data).toEqual({ a: 1 })
    const s2 = S.create<{ a?: { b?: number } }, { a?: { b?: number } }>({ fields: {} })
    s2.change({ a: { b: 2 } })
    expect(s2.data).toEqual({ a: { b: 2 } })
    const s3 = S.create<{ a?: R<{ b?: number }> }, { a?: R<{ b?: number }> }>({ fields: {} })
    s3.change({ a: { foobar: { b: 2 } } })
    expect(s3.data).toEqual({ a: { foobar: { b: 2 } } })
  })
})

describe('leaf initializers', () => {
  describe('throw an error', () => {
    it('when not assigned a function', () => {
      expect(() =>
        // @ts-expect-error
        S.create<{ a?: number }>({ fields: { a: { initial: 1 } } })
      ).toThrowError(
        'Initializer for setting "a" was configured with a static value. It must be a function. Got: 1'
      )
    })
    it('gracefully upon an unexpected error', () => {
      expect(() =>
        S.create<{ a?: number }>({
          fields: {
            a: {
              initial() {
                throw new Error('Unexpected error while trying to initialize setting')
              },
            },
          },
        })
      ).toThrowError(
        'There was an unexpected error while running the initializer for setting "a" \nUnexpected error while trying to initialize setting'
      )
    })
  })
  describe('encounter static errors', () => {
    it('when undefined is returned', () => {
      // cannot throw error for this b/c sometimes undefined is acceptable (see other tests)
      // @ts-expect-error
      S.create<{ a?: string }>({ fields: { a: { initial: c(undefined) } } })
    })
    it('when used on an input field that is required', () => {
      // @ts-expect-error
      S.create<{ a: number }>({ fields: { a: { initial: c(1) } } })
    })
    it('when return a type that is not assignable to the input field', () => {
      // @ts-expect-error
      S.create<{ a?: string }>({ fields: { a: { initial: c(1) } } })
      // @ts-expect-error
      S.create<{ a?: string | boolean }>({ fields: { a: { initial: c(1) } } })
    })
  })
  it('are run at create time', () => {
    const s = S.create<{ a?: number }>({ fields: { a: { initial: c(1) } } })
    expect(s.data.a).toEqual(1)
  })
  describe('with optional data field', () => {
    it('can be omitted even if the input is optional, in which case the data initializes to undefined', () => {
      const s = S.create<{ a?: number }, { a?: number }>({ fields: { a: {} } })
      expect(s.data.a).toBeUndefined()
    })
    it('can still be provided, in which case the data initializes to the returned value like usual', () => {
      const s = S.create<{ a?: number }, { a?: number }>({ fields: { a: { initial: c(1) } } })
      expect(s.data.a).toEqual(1)
    })
    it('can still be provided, but can now return undefined', () => {
      const s = S.create<{ a?: number }, { a?: number }>({ fields: { a: { initial: c(undefined) } } })
      expect(s.data.a).toBeUndefined()
    })
  })
  describe('can be for input fields of type', () => {
    it('function', () => {
      const s = S.create<{ a?: (n: number) => number }>({ fields: { a: { initial: c((x) => x + 1) } } })
      expect(s.data.a(1)).toEqual(2)
    })
    it('array', () => {
      const s = S.create<{ a?: 1[] }>({ fields: { a: { initial: c([1]) } } })
      expect(s.data.a).toEqual([1])
    })
    it('null', () => {
      const s = S.create<{ a?: null }>({ fields: { a: { initial: c(null) } } })
      expect(s.data.a).toEqual(null)
    })
    // prettier-ignore
    it('boolean, number, string, literal', () => {
      expect(S.create<{ a?: boolean }>({ fields: { a: { initial: c(true) } } }).data.a).toEqual(true)
      expect(S.create<{ a?: number }>({ fields: { a: { initial: c(1) } } }).data.a).toEqual(1)
      expect(S.create<{ a?: 2 }>({ fields: { a: { initial: c(2) } } }).data.a).toEqual(2)
      expect(S.create<{ a?: string }>({ fields: { a: { initial: c('a') } } }).data.a).toEqual('a')
    })
  })
})

describe('spec validation', () => {
  it('if mapType is assigned non-function', () => {
    expect(() => {
      // @ts-expect-error
      S.create<{ a: number }, { a: boolean }>({ fields: { a: { mapType: 1 } } })
    }).toThrowError('Type mapper for setting "a" was invalid. Type mappers must be functions. Got: 1')
  })
  it('if mapType is assigned non-function (record)', () => {
    expect(() => {
      // prettier-ignore
      S.create<{ a: Record<string, {b:1}> }, { a: Record<string, {b:2}> }>({ fields: { a: { entry: { fields: { b: { mapType: 1 as any } } } } } })
    }).toThrowError('Type mapper for setting "b" was invalid. Type mappers must be functions. Got: 1')
  })
})

describe('leaf type mappers', () => {
  it('do not relate to the optionality of the input or the data', () => {
    // show that  mapType is still an required
    S.create<{ a?: number }, { a: boolean }>({
      fields: { a: { mapType: (a) => Boolean(a), initial: () => 1 } },
    })
    S.create<{ a: number }, { a?: boolean }>({ fields: { a: { mapType: (a) => a === 1 } } })
    // show that missing mapType is still an error
    // @ts-expect-error
    S.create<{ a?: number }, { a: boolean }>({ fields: { a: { initial: () => 1 } } })
    // @ts-expect-error
    S.create<{ a: number }, { a?: boolean }>({ fields: { a: {} } })
  })
  describe('receive one parameter containing the input that is', () => {
    it('not optional', () => {
      //prettier-ignore
      S.create<{ a: number }, { a: boolean }>({ fields: { a: { mapType: (a) => { tsd.expectType<number>(a); return true } } } })
    })
    it('not optional even if input field is optional', () => {
      //prettier-ignore
      S.create<{ a?: number }, { a: boolean }>({ fields: { a: { mapType: (a) => { tsd.expectType<number>(a); return true }, initial: () => 1 } } })
    })
  })
  describe('return type', () => {
    it('includes undefined if data is optionl', () => {
      S.create<{ a: number }, { a?: boolean }>({ fields: { a: { mapType: () => undefined } } })
    })
  })
  describe('at construction time', () => {
    it('maps the initial value to its data value', () => {
      const s = S.create<{ a?: number }, { a: boolean }>({
        fields: { a: { initial: () => 1, mapType: (n) => n === 1 } },
      })
      expect(s.data.a).toEqual(true)
    })
    it('gracefully throws if unexpectedly fail', () => {
      expect(() => {
        //prettier-ignore
        S.create<{ a: number }, { a?: boolean }>({ fields: { a: { mapType() { throw new Error('Oops') } } } })
      }).toThrowError('There was an unexpected error while running the type mapper for setting "a" \nOops')
    })
  })
  describe('at change time', () => {
    it('maps the changed value to its data value', () => {
      // prettier-ignore
      const s = S.create<{ a?: number }, { a: boolean }>({ fields: { a: { initial: () => 1, mapType: (n) => n === 1 } } })
      s.change({ a: 2 })
      expect(s.data.a).toEqual(false)
    })
    it('gracefully throws if unexpectedly fail', () => {
      //prettier-ignore
      const mapType = jest.fn().mockImplementationOnce(() => true).mockImplementation(() => { throw new Error('Oops') })
      expect(() => {
        //prettier-ignore
        const s = S.create<{ a: number }, { a?: boolean }>({ fields: { a: { mapType } } })
        s.change({ a: 2 })
      }).toThrowError('There was an unexpected error while running the type mapper for setting "a" \nOops')
    })
  })
  describe('encounter static errors', () => {
    it('are required when input type is not assignable to data type', () => {
      S.create<{ a: number }, { a: boolean }>({ fields: { a: { mapType: (a) => Boolean(a) } } })
      // @ts-expect-error
      S.create<{ a: number }, { a: boolean }>({ fields: { a: {} } })
    })
    it('are forbidden when the input type is assignable to data type', () => {
      // @ts-expect-error
      S.create<{ a: number }, { a: number }>({ fields: { a: { mapType: (a) => Boolean(a) } } })
    })
    it('must return a type assignable to the field data', () => {
      // @ts-expect-error
      S.create<{ a: number }, { a: boolean }>({ fields: { a: { mapType: () => 1 } } })
    })
  })
})

describe('namespaces', () => {
  describe('static errors', () => {
    it('a field requires an initializer if the input is optional', () => {
      S.create<{ a?: { b?: 1 } }>({ fields: { a: { fields: { b: { initial: c(1) } } } } })
      // @ts-expect-error
      S.create<{ a?: { b?: 1 } }>({ fields: { a: { fields: { b: {} } } } })
    })
    it('a field cannot have an initializer if the input is required', () => {
      S.create<{ a: { b: 1 } }>({ fields: { a: { fields: { b: {} } } } })
      // @ts-expect-error
      S.create<{ a: { b: 1 } }>({ fields: { a: { fields: { b: { initial: c(1) } } } } })
    })
    it('if the namespace is optional but its fields are required then namespace must have initializer', () => {
      S.create<{ a?: { b: 1 } }>({ fields: { a: { initial: c({ b: 1 }), fields: { b: {} } } } })
      // @ts-expect-error missing a.initial
      S.create<{ a?: { b: 1 } }>({ fields: { a: { fields: { b: {} } } } })
    })
    it('namespace initializer only needs to return required fields', () => {
      S.create<{ a?: { b: 1; c?: 2 } }>({
        fields: { a: { initial: c({ b: 1 }), fields: { b: {}, c: { initial: c(2) } } } },
      })
      // @ts-expect-error missing initializer
      S.create<{ a?: { b: 1; c?: 2 } }>({ fields: { a: { initial: c({ b: 1 }), fields: { b: {}, c: {} } } } })
      // prettier-ignore
      // @ts-expect-error missing required fields in namespace initializer
      S.create<{ a?: { b: 1; c?: 2 } }>({ fields: { a: { initial: c({}), fields: { b: {}, c: { initial: c(2) } } } } })
    })
  })
  describe('initializer', () => {
    it('statically required when namespace optional', () => {
      // @ts-expect-error
      S.create<{ a?: { b: 1 } }>({ fields: { a: { fields: { b: {} } } } })
      S.create<{ a?: { b: 1 } }>({ fields: { a: { initial: c({ b: 1 }), fields: { b: {} } } } })
    })
    it('statically forbidden when namespace optional, but no required fields within', () => {
      // @ ts-expect-error
      // todo not failing right now because of excess property checks
      S.create<{ a?: { b?: 1 } }>({ fields: { a: { fields: { initial: c({}), b: { initial: c(1) } } } } })
    })
    it('statically optional when namespace optional and has 1+ required fields within, but is also optional in the data', () => {
      S.create<{ a?: { b?: 1 } }, { a?: { b: 1 } }>({ fields: { a: { fields: { b: { initial: c(1) } } } } })
      // prettier-ignore
      // todo initial is not actually allowed here, only looks like it b/c of excess property checks
      S.create<{ a?: { b?: 1 } }, { a?: { b: 1 }}>({ fields: { a: { initial: c({}), fields: { b: { initial: c(1) } } } } })
    })
    it('accepted when namespace optional in input but required in data; it initializes trees under required fields', () => {
      const s = S.create<{ a?: { b: 1 } }>({ fields: { a: { initial: c({ b: 1 }), fields: { b: {} } } } })
      expect(s.data).toEqual({ a: { b: 1 } })
    })
    it('statically (todo) cannot provide optional fields and if it does are overriden by the field initializer', () => {
      // todo this should raise a compiler warning but it does not because of https://github.com/microsoft/TypeScript/issues/241#issuecomment-669138047
      // @ ts-expect-error c prop forbidden from namespace initializer
      // prettier-ignore
      const s = S.create<{ a?: { b: 1, c?: number } }>({ fields: { a: { log:{b:1,c:2}, log2: {b:1,c:2}, initial(){ return { b:1, c: 3 } }, fields: { b: {}, c:{initial: c(2) } } } } })
      expect(s.data).toEqual({ a: { b: 1, c: 2 } })
    })
  })

  it('a field initializer initializes its data', () => {
    const settings = S.create<{ a?: { b?: 1 } }>({ fields: { a: { fields: { b: { initial: c(1) } } } } })
    expect(settings.data.a.b).toEqual(1)
  })
  it('data can be changed', () => {
    const settings = S.create<{ a?: { b?: number } }>({ fields: { a: { fields: { b: { initial: c(1) } } } } })
    expect(settings.change({ a: { b: 2 } }).data).toEqual({ a: { b: 2 } })
  })
  it('data merges deeply preserving existing data not targetted by input', () => {
    const settings = S.create<{ a?: { a?: number; b?: number }; b?: number }>({
      fields: {
        a: { fields: { a: { initial: c(1) }, b: { initial: c(2) } } },
        b: { initial: c(3) },
      },
    })
    expect(settings.change({ a: { a: 4 } }).data).toEqual({ a: { a: 4, b: 2 }, b: 3 })
  })
  // todo bring back in strict mode, see commented out code in resolve func
  it.skip('passing a plain object to a non-namespace field will error gracefully', () => {
    const s = S.create<{ a?: 1 }>({ fields: { a: { initial: c(1) } } })
    // @ts-expect-error
    expect(() => s.change({ a: { b: 2 } })).toThrowErrorMatchingInlineSnapshot(
      `"Setting \\"a\\" is not a namespace or record and so does not accept objects, but one given: { b: 2 }"`
    )
  })
  describe('with shorthands', () => {
    it('allow a value to be assigned directly to the namespace field', () => {
      type i = { a?: number | { b?: number } }
      type d = { a: { b: number } }
      const settings = S.create<i, d>({
        // prettier-ignore
        fields: { a: { shorthand: (value) => ({ b: value + 100 }), fields: { b: { initial: c(1) } } } }
      })
      expect(settings.data).toEqual({ a: { b: 1 } })
      expect(settings.change({ a: 2 }).data).toEqual({ a: { b: 102 } })
    })
    describe('runtime errors', () => {
      it('unexpected shorthand errors fail gracefully', () => {
        type d = { a: { b: number } }
        type i = { a: number | { b: number } }
        // prettier-ignore
        const s = S.create<i, d>({ fields: { a: { shorthand(value) { throw new Error(`Unexpected shorthand error with value ${value}`) }, fields: { b: { initial: c('') } } } } })
        expect(() => s.change({ a: 100 }).data.a).toThrowError(
          'There was an unexpected error while running the namespace shorthand for setting "a". The given value was 100 \nUnexpected shorthand error with value 100'
        )
      })
    })
    it('still accepts longhand input', () => {
      type d = { a: { b: number } }
      type i = { a: number | { b: number } }
      const s = S.create<i, d>({
        // prettier-ignore
        fields: { a: { shorthand: (n) => ({ b: n + 100 }) , fields: { b: { initial: c(1) } } } }
      })
      expect(s.change({ a: { b: 3 } }).data.a).toEqual({ b: 3 })
    })
    it('can be a type that differs from the longhand', () => {
      const s = S.create<{ a: (() => number) | { b: string } }, { a: { b: string } }>({
        // prettier-ignore
        fields: { a: { shorthand: (f) => ({ b: f().toString() }), fields: { b: {} } } }
      })
      expect(s.change({ a: () => 1 }).data).toEqual({ a: { b: '1' } })
    })
    it('if input/data types differ and shorthand used the type mapper receives the expanded input', () => {
      // prettier-ignore
      const s = S.create<{ a: string | { b: string } }, { a: { b: number } }>({
        fields: { a: {
          shorthand: (s) => ({b:s}),
          fields: { b: { mapType(v) { tsd.expectType<string>(v); return Number(v) } } } } }
      })
      expect(s.change({ a: '1' }).data).toEqual({ a: { b: 1 } })
    })
    it('changing with a shorthand on a namespace that does not support them will error gracefully', () => {
      const s = S.create<{ a: { b: string } }>({ fields: { a: { fields: { b: {} } } } })
      // @ts-expect-error
      expect(() => s.change({ a: 'runtime error' })).toThrowError(
        'Setting "a" is a namespace with no shorthand so expects an object but received a non-object: \'runtime error\''
      )
    })
  })
})

describe('records', () => {
  it('can have their settings changed', () => {
    const s = S.create<{ a: R<{ b: number }> }>({ fields: { a: { entry: { fields: { b: {} } } } } })
    expect(s.change({ a: { foobar: { b: 2 } } }).data).toEqual({ a: { foobar: { b: 2 } } })
  })
  describe('initial', () => {
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
})

describe('runtime errors', () => {
  // todo bring this back under strict mode
  it.skip('changing settings that do not exist will have static error and will error gracefully', () => {
    const s = S.create<{ a: string }>({ fields: { a: {} } })
    // prettier-ignore
    // @ts-expect-error
    expect(() => s.change({ z: '' })).toThrowError('You are trying to change a setting called "z" but no such setting exists')
  })
})

describe('leaf fixups', () => {
  let logs: jest.Mock
  let logSettingsOriginal: any

  beforeEach(() => {
    logs = jest.fn()
    logSettingsOriginal = {
      output: log.settings.output,
      filter: log.settings.filter.originalInput,
      pretty: log.settings.pretty,
    }
    log.settings({ output: { write: logs }, pretty: false })
  })

  afterEach(() => {
    log.settings(logSettingsOriginal)
  })

  describe('when onFixup handler', () => {
    it('is set then called when fixup fixes something', () => {
      const onFixup = jest.fn()
      const s = S.create<{ path: string }>({
        onFixup,
        fields: {
          path: {
            fixup(value) {
              if (value[0] === '/') return null
              return { messages: ['must have leading slash'], value: `/${value}` }
            },
          },
        },
      })
      expect(s.change({ path: 'foo' }).data).toEqual({ path: '/foo' })
      expect(onFixup.mock.calls).toMatchInlineSnapshot(`
              Array [
                Array [
                  Object {
                    "after": "/foo",
                    "before": "foo",
                    "messages": Array [
                      "must have leading slash",
                    ],
                    "name": "path",
                  },
                  [Function],
                ],
              ]
          `)
    })
    it('fails then it errors gracefully', () => {
      // prettier-ignore
      const onFixup = jest.fn().mockImplementation(() => { throw new Error('Unexpected error!') })
      // prettier-ignore
      const s = S.create<{ path: string }>({ onFixup, fields: { path: { fixup() { return { value: 'foobar', messages: [] } } } } })
      expect(() => s.change({ path: '' })).toThrowError(
        'onFixup callback for "path" failed \nUnexpected error!'
      )
    })
    it('is not called for a fixup that returns null', () => {
      const onFixup = jest.fn()
      const s = S.create<{ path: string }>({ onFixup, fields: { path: { fixup: () => null } } })
      s.change({ path: '' })
      expect(onFixup.mock.calls).toEqual([])
    })
    it('not set then defualt is to log a warning', () => {
      log.settings({ filter: '*@warn' })
      // prettier-ignore
      const s = S.create<{ a: string }>({ fields: { a: { fixup() { return { value: 'fixed', messages: ['...'] } } } } })
      s.change({ a: 'foo' })
      expect(logs.mock.calls).toMatchInlineSnapshot(`
        Array [
          Array [
            "{\\"event\\":\\"One of your setting values was invalid. We were able to automaticlaly fix it up now but please update your code.\\",\\"level\\":4,\\"path\\":[\\"settings\\"],\\"context\\":{\\"before\\":\\"foo\\",\\"after\\":\\"fixed\\",\\"name\\":\\"a\\",\\"messages\\":[\\"...\\"]}}
        ",
          ],
        ]
      `)
    })
    it('is set then default handler is not run', () => {
      log.settings({ filter: '*@warn' })
      // prettier-ignore
      const s = S.create<{ a: string }>({ onFixup() {}, fields: { a: { fixup() { return { value: 'fixed', messages: ['...'] } } } } })
      s.change({ a: 'foo' })
      expect(logs.mock.calls).toEqual([])
    })
    it('is set it can call the original handler to retain the original base behaviour', () => {
      log.settings({ filter: '*@warn' })
      // prettier-ignore
      const s = S.create<{ a: string }>({ onFixup(info, original) { original(info) }, fields: { a: { fixup() { return { value: 'fixed', messages: ['...'] } } } } })
      s.change({ a: 'foo' })
      expect(logs.mock.calls).toMatchInlineSnapshot(`
        Array [
          Array [
            "{\\"event\\":\\"One of your setting values was invalid. We were able to automaticlaly fix it up now but please update your code.\\",\\"level\\":4,\\"path\\":[\\"settings\\"],\\"context\\":{\\"before\\":\\"foo\\",\\"after\\":\\"fixed\\",\\"name\\":\\"a\\",\\"messages\\":[\\"...\\"]}}
        ",
          ],
        ]
      `)
    })
  })
  it('a namespace with shorthand runs through fixups too', () => {
    const onFixup = jest.fn()
    // prettier-ignore
    const settings = S.create<{ a: number | { a: number } }>({
      onFixup,
      fields: { a: { shorthand: (a) => ({ a }), fields: { a: { fixup: (value) => ({ messages: [`must be 1, was ${value}`], value: 1 }) } } } },
    })
    expect(settings.change({ a: 2 }).data).toEqual({ a: { a: 1 } })
    expect(onFixup.mock.calls).toMatchInlineSnapshot(`
        Array [
          Array [
            Object {
              "after": 1,
              "before": 2,
              "messages": Array [
                "must be 1, was 2",
              ],
              "name": "a",
            },
            [Function],
          ],
        ]
      `)
  })
  it('if fixup fails it errors gracefully', () => {
    // prettier-ignore
    const s = S.create<{ path: string }>({ fields: { path: { fixup() { throw new Error('Unexpected error!') } } } })
    expect(() => s.change({ path: '' })).toThrowError(
      'Fixup for "path" failed while running on value \'\' \nUnexpected error!'
    )
  })
  describe('static errors', () => {
    it('fixup return .value prop must match the input type', () => {
      // @ts-expect-error
      // prettier-ignore
      S.create<{ a: 1 }>({ fields: { a: { fixup() { return { value: 2, messages: [] } } } } }).data
    })
  })
  it('initial does not pass through fixup', () => {
    // prettier-ignore
    expect(
      S.create<{ a?: number }>({ fields: { a: { initial: () => 1, fixup() { return { value: 2, messages: [] } } } } }).data
    ).toEqual({ a: 1 })
  })
})

describe('leaf validators', () => {
  it('if a setting passes validation nothing happens', () => {
    const validate = jest.fn().mockImplementation(() => null)
    const settings = S.create<{ a: string }>({ fields: { a: { validate } } })
    settings.change({ a: 'bar' })
    expect(validate.mock.calls).toEqual([['bar']])
  })
  it('if a setting fails validation then an error is thrown', () => {
    const validate = jest.fn().mockImplementation((value) => {
      if (value === 'bar') return { messages: ['Too long', 'Too simple'] }
    })
    const s = S.create<{ a: string }>({ fields: { a: { validate } } })
    expect(() => s.change({ a: 'bar' })).toThrowError(dedent`
      Your setting "a" failed validation with value 'bar':

      - Too long
      - Too simple
    `)
  })
  it('initial does not pass through validate', () => {
    const validate = jest.fn().mockImplementation((value) => {
      if (value === 'bad') return { messages: ['foobar'] }
    })
    expect(
      S.create<{ a?: number }>({ fields: { a: { initial: c(1), validate } } }).data
    ).toEqual({ a: 1 })
  })
  it('unexpected validator failures error gracefully', () => {
    const validate = jest.fn().mockImplementation((value) => {
      throw new Error('Unexpected error while trying to validate')
    })
    const settings = S.create<{ a: string }>({ fields: { a: { validate } } })
    expect(() => settings.change({ a: 'bar' })).toThrowError(
      'Validation for "a" unexpectedly failed while running on value \'bar\' \nUnexpected error while trying to validate'
    )
  })
})

describe('.reset()', () => {
  it('returns api for chaining', () => {
    const settings = S.create<{ a?: string }>({ fields: { a: { initial: c('') } } })
    expect(settings.reset()).toBe(settings)
  })
  it('resets settings data & metadata to initial state', () => {
    const settings = S.create<{ a?: string }>({ fields: { a: { initial: c('') } } })
    settings.change({ a: 'foo' })
    expect(settings.reset().data).toEqual({ a: '' })
    // prettier-ignore
    expect(settings.reset().metadata).toEqual({
      type: 'namespace', fields: { a: { type: 'leaf', from: 'initial', value: '', initial: '' } },
    })
  })
  it('settings metadata & data references change', () => {
    const settings = S.create<{ a?: string }>({ fields: { a: { initial: c('') } } })
    const originalMetadata = settings.metadata
    const originalData = settings.data
    settings.reset()
    expect(settings.data).not.toBe(originalData)
    expect(settings.metadata).not.toBe(originalMetadata)
  })
  it('dynamic initializers are re-run', () => {
    process.env.foo = 'foo'
    const settings = S.create<{ a?: string }>({ fields: { a: { initial: () => process.env.foo! } } })
    process.env.foo = 'bar'
    // prettier-ignore
    expect(settings.reset().metadata).toEqual({
      type: 'namespace', fields: { a: { type: 'leaf', from: 'initial', value: 'bar', initial: 'bar' } },
    })
    delete process.env.foo
  })
})

describe('.original()', () => {
  it('gets the settings as they were initially', () => {
    const settings = S.create<{ a?: { a?: string }; b?: { a?: number } }>({
      fields: {
        a: { fields: { a: { initial: () => 'foo' } } },
        b: { fields: { a: { initial: () => 1 } } },
      },
    })
    const original = Lo.cloneDeep(settings.data)
    settings.change({ a: { a: 'bar' }, b: { a: 2 } })
    expect(settings.original()).toEqual(original)
  })
})

describe('.metadata', () => {
  it('tracks if a setting value comes from its initializer', () => {
    const s = S.create<{ a?: string }>({ fields: { a: { initial: c('foo') } } })
    // prettier-ignore
    expect(s.metadata).toEqual({ type: 'namespace', fields: { a: { type: 'leaf', from: 'initial', value: 'foo', initial: 'foo' } } })
  })
  it('traces if a setting value comes from change input', () => {
    const s = S.create<{ a?: string }>({ fields: { a: { initial: c('foo') } } })
    // prettier-ignore
    expect(s.change({ a: 'bar' }).metadata).toEqual({
      type: 'namespace', fields: { a: { type: 'leaf', from: 'set', value: 'bar', initial: 'foo' } },
    })
  })
  it('models namespaces', () => {
    const s = S.create<{ a?: { a?: string } }>({ fields: { a: { fields: { a: { initial: c('foo') } } } } })
    // prettier-ignore
    expect(s.metadata).toEqual({
      type: 'namespace', fields: { a: { type: 'namespace', fields: { a: { type: 'leaf', from: 'initial', value: 'foo', initial: 'foo' } } } },
    })
  })
  it('models nested namespaces', () => {
    // prettier-ignore
    const s = S.create<{ a?: { b?: { c?: number } } }>({ fields: { a: { fields: { b: { fields: { c: { initial: c(1) } } } } } } })
    // prettier-ignore
    expect(s.metadata).toEqual({
      type: 'namespace', fields: { a: { type: 'namespace', fields: { b: { type: 'namespace', fields: { c: { type: 'leaf', from: 'initial', value: 1, initial: 1 } } } } } },
    })
  })
})

describe('.change()', () => {
  it('arrays do not merge', () => {
    const s = S.create<{ a?: string[] }>({ fields: { a: { initial: c(['foo']) } } })
    expect(s.change({ a: ['bar'] }).data).toEqual({ a: ['bar'] })
  })
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
