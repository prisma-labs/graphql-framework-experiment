import * as tsd from 'tsd'
import * as S from '..'

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

/**
 * Helpers
 */

/**
 * Create a constant function
 */
const c = <T>(x: T) => () => x
