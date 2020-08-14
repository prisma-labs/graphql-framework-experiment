import * as S from '..'

describe('input specifiers', () => {
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

describe('.change()', () => {
  it('arrays do not merge', () => {
    const s = S.create<{ a?: string[] }>({ fields: { a: { initial: c(['foo']) } } })
    expect(s.change({ a: ['bar'] }).data).toEqual({ a: ['bar'] })
  })
  // todo bring this back under strict mode
  it.skip('changing settings that do not exist will have static error and will error gracefully', () => {
    const s = S.create<{ a: string }>({ fields: { a: {} } })
    // prettier-ignore
    // @ts-expect-error
    expect(() => s.change({ z: '' })).toThrowError('You are trying to change a setting called "z" but no such setting exists')
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
