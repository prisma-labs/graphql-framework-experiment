import { log } from '@nexus/logger'
import dedent from 'dedent'
import * as tsd from 'tsd'
import * as S from '..'

describe('initial()', () => {
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

describe('mapType()', () => {
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

describe('validators', () => {
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

/**
 * Helpers
 */

/**
 * Create a constant function
 */
const c = <T>(x: T) => () => x
