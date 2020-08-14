import * as Lo from 'lodash'
import * as S from '..'

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

/**
 * Helpers
 */

/**
 * Create a constant function
 */
const c = <T>(x: T) => () => x
