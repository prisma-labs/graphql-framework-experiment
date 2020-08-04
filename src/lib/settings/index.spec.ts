import 'jest-extended'
import * as S from './'

describe('input field initializers', () => {
  describe('throw an error', () => {
    it('when not assigned a function', () => {
      expect(() =>
        // @ts-expect-error
        S.create<{ a?: number }>({ spec: { a: { initial: 1 } } })
      ).toThrowError(
        'Initializer for setting "a" was configured with a static value. It must be a function. Got: 1'
      )
    })
    it('gracefully upon an unexpected error', () => {
      expect(() =>
        S.create<{ a?: number }>({
          spec: {
            a: {
              initial() {
                throw new Error('Unexpected error while trying to initialize setting')
              },
            },
          },
        })
      ).toThrowError(
        'There was an unexpected error while running the dynamic initializer for setting "a" \nUnexpected error while trying to initialize setting'
      )
    })
  })
  describe('encounter static errors', () => {
    it('when undefined is returned', () => {
      // cannot throw error for this b/c sometimes undefined is acceptable (see other tests)
      // @ts-expect-error
      S.create<{ a?: string }>({ spec: { a: { initial: c(undefined) } } })
    })
    it('when used on an input field that is required', () => {
      // @ts-expect-error
      S.create<{ a: number }>({ spec: { a: { initial: c(1) } } })
    })
    it('when return a type that is not assignable to the input field', () => {
      // @ts-expect-error
      S.create<{ a?: string }>({ spec: { a: { initial: c(1) } } })
      // @ts-expect-error
      S.create<{ a?: string | boolean }>({ spec: { a: { initial: c(1) } } })
    })
  })
  it('are run at create time', () => {
    const s = S.create<{ a?: number }>({ spec: { a: { initial: c(1) } } })
    expect(s.data.a).toEqual(1)
  })
  describe('with optional data field', () => {
    it('can be omitted even if the input is optional, in which case the data initializes to undefined', () => {
      const s = S.create<{ a?: number }, { a?: number }>({ spec: { a: {} } })
      expect(s.data.a).toBeUndefined()
    })
    it('can still be provided, in which case the data initializes to the returned value like usual', () => {
      const s = S.create<{ a?: number }, { a?: number }>({ spec: { a: { initial: c(1) } } })
      expect(s.data.a).toEqual(1)
    })
    it('can still be provided, but can now return undefined', () => {
      const s = S.create<{ a?: number }, { a?: number }>({ spec: { a: { initial: c(undefined) } } })
      expect(s.data.a).toBeUndefined()
    })
  })
  describe('can be for input fields of type', () => {
    it('function', () => {
      const s = S.create<{ a?: (n: number) => number }>({ spec: { a: { initial: c((x) => x + 1) } } })
      expect(s.data.a(1)).toEqual(2)
    })
    it('array', () => {
      const s = S.create<{ a?: 1[] }>({ spec: { a: { initial: c([1]) } } })
      expect(s.data.a).toEqual([1])
    })
    it('null', () => {
      const s = S.create<{ a?: null }>({ spec: { a: { initial: c(null) } } })
      expect(s.data.a).toEqual(null)
    })
    //prettier-ignore
    it('boolean, number, string', () => {
      expect(S.create<{ a?: boolean }>({ spec: { a: { initial: c(true) } } }).data.a).toEqual(true)
      expect(S.create<{ a?: number }>({ spec: { a: { initial: c(1) } } }).data.a).toEqual(1)
      expect(S.create<{ a?: string }>({ spec: { a: { initial: c('a') } } }).data.a).toEqual('a')
    })
  })
})

describe('input field type mappers', () => {})

// describe('namespaced settings', () => {
//   it('a setting may be a namespace holding more settings', () => {
//     type d = { a: { b: string } }
//     const settings = S.create<d>({ spec: { a: { fields: { b: { initial: c('') } } } } })
//     expect(settings.data.a.b).toEqual('')
//   })
//   it('a namespaced setting can be changed', () => {
//     type d = { a: { b: string } }
//     const settings = S.create<d>({ spec: { a: { fields: { b: { initial: c('b') } } } } })
//     expect(settings.change({ a: { b: 'b2' } }).data).toEqual({ a: { b: 'b2' } })
//   })
//   it('changing namespaced settings merges deeply preserving existing settings not targetted by the change', () => {
//     type d = { a: { a: string; b: number }; b: number }
//     const settings = S.create<d>({
//       spec: {
//         a: {
//           fields: {
//             b: { initial: c(1) },
//             a: { initial: c('a') },
//           },
//         },
//         b: { initial: c(1) },
//       },
//     })
//     expect(settings.change({ a: { a: 'a2' } }).data).toEqual({ a: { a: 'a2', b: 1 }, b: 1 })
//   })
//   it('giving object to a non-namespace will error gracefully', () => {
//     type d = { a: string }
//     const settings = S.create<d, any>({ spec: { a: { initial: c('') } } })
//     expect(() => settings.change({ a: { b: '' } })).toThrowErrorMatchingInlineSnapshot(
//       `"Setting \\"a\\" is not a namespace and so does not accept objects, but one given: { b: '' }"`
//     )
//   })
// })

// describe('namespace shorthands', () => {
//   it('a namespace may have a shorthand', () => {
//     type d = { a: { b: string } }
//     type i = { a: string | { b: string } }
//     const settings = S.create<d, i>({
//       spec: {
//         a: {
//           shorthand(value) {
//             return { b: value + ' via shorthand!' }
//           },
//           fields: { b: { initial: c('') } },
//         },
//       },
//     })
//     expect(settings.data.a.b).toEqual('')
//     expect(settings.change({ a: 'some change' }).data.a).toEqual({ b: 'some change via shorthand!' })
//   })
//   it('unexpected shorthand errors fail gracefully', () => {
//     type d = { a: { b: string } }
//     type i = { a: string | { b: string } }
//     const settings = S.create<d, i>({
//       spec: {
//         a: {
//           shorthand(value) {
//             throw new Error('Unexpected shorthand error')
//           },
//           fields: { b: { initial: c('') } },
//         },
//       },
//     })
//     expect(() => settings.change({ a: 'some change' }).data.a).toThrowErrorMatchingInlineSnapshot(`
//       "There was an unexpected error while running the namespace shorthand for setting \\"a\\". The given value was 'some change'
//       Unexpected shorthand error"
//     `)
//   })
//   it('a namespace with a shorthand still accepts non-shorthand input', () => {
//     type d = { a: { b: string } }
//     type i = { a: string | { b: string } }
//     const settings = S.create<d, i>({
//       spec: {
//         a: {
//           shorthand(value) {
//             return { b: value + ' via shorthand!' }
//           },
//           fields: { b: { initial: c('') } },
//         },
//       },
//     })
//     expect(settings.change({ a: { b: 'direct' } }).data.a).toEqual({ b: 'direct' })
//   })
//   it('a namespace shorthand can receive input that is not directly in the final data', () => {
//     type d = { a: { b: string } }
//     type i = { a: (() => number) | { b: string } }
//     const settings = S.create<d, i>({
//       spec: {
//         a: {
//           shorthand(f) {
//             return { b: f().toString() }
//           },
//           fields: { b: { initial: c('') } },
//         },
//       },
//     })
//     expect(settings.change({ a: () => 1 }).data).toEqual({ a: { b: '1' } })
//   })
//   it('giving shorthand to a namespace that does not support it will error gracefully', () => {
//     type d = { a: { b: string } }
//     const settings = S.create<d, any>({ spec: { a: { fields: { b: { initial: c('') } } } } })
//     expect(() => settings.change({ a: 'runtime error' })).toThrowErrorMatchingInlineSnapshot(
//       `"Setting \\"a\\" is a namespace with no shorthand so expects an object but received a non-object: 'runtime error'"`
//     )
//   })
// })

// describe('runtime errors', () => {
//   it('changing settings that do not exist will error gracefully', () => {
//     type d = { a: string }
//     const settings = S.create<d, any>({ spec: { a: { initial: c('') } } })
//     expect(() => settings.change({ z: '' })).toThrowErrorMatchingInlineSnapshot(
//       `"Could not find a setting specifier for setting \\"z\\""`
//     )
//   })
// })

// it('a setting can be changed', () => {
//   type d = { a: string }
//   const settings = S.create<d>({ spec: { a: { initial: c('a') } } })
//   expect(settings.change({ a: 'a2' }).data).toEqual({ a: 'a2' })
// })

// describe('fixups', () => {
//   let logs: jest.Mock
//   let logSettingsOriginal: any

//   beforeEach(() => {
//     logs = jest.fn()
//     logSettingsOriginal = {
//       output: log.settings.output,
//       filter: log.settings.filter.originalInput,
//       pretty: log.settings.pretty,
//     }
//     log.settings({ output: { write: logs }, pretty: false })
//   })

//   afterEach(() => {
//     log.settings(logSettingsOriginal)
//   })

//   it('a setting can be fixed up', () => {
//     const onFixup = jest.fn()
//     type d = { path: string }
//     const settings = S.create<d>({
//       onFixup,
//       spec: {
//         path: {
//           initial: c('/foo'),
//           fixup(value) {
//             if (value[0] === '/') return null
//             return { messages: ['must have leading slash'], value: `/${value}` }
//           },
//         },
//       },
//     })
//     expect(settings.change({ path: 'foo' }).data).toEqual({ path: '/foo' })
//     expect(onFixup.mock.calls).toMatchInlineSnapshot(`
//       Array [
//         Array [
//           Object {
//             "after": "/foo",
//             "before": "foo",
//             "messages": Array [
//               "must have leading slash",
//             ],
//             "name": "path",
//           },
//           [Function],
//         ],
//       ]
//     `)
//   })
//   it('a namespace with shorthand runs through fixups too', () => {
//     const onFixup = jest.fn()
//     type d = { path: string | { to: string } }
//     const settings = S.create<d>({
//       onFixup,
//       spec: {
//         path: {
//           shorthand(value) {
//             return { to: value }
//           },
//           fields: {
//             to: {
//               initial: c('/foo'),
//               fixup(value) {
//                 if (value[0] === '/') return null
//                 return { messages: ['must have leading slash'], value: `/${value}` }
//               },
//             },
//           },
//         },
//       },
//     })
//     expect(settings.change({ path: 'foo' }).data).toEqual({ path: { to: '/foo' } })
//     expect(onFixup.mock.calls).toMatchInlineSnapshot(`
//       Array [
//         Array [
//           Object {
//             "after": "/foo",
//             "before": "foo",
//             "messages": Array [
//               "must have leading slash",
//             ],
//             "name": "to",
//           },
//           [Function],
//         ],
//       ]
//     `)
//   })
//   it('if fixup fails it errors gracefully', () => {
//     type d = { path: string }
//     const settings = S.create<d>({
//       spec: {
//         path: {
//           initial: c('/'),
//           fixup() {
//             throw new Error('Unexpected error!')
//           },
//         },
//       },
//     })
//     expect(() => settings.change({ path: '' })).toThrowErrorMatchingInlineSnapshot(`
//       "Fixup for \\"path\\" failed while running on value ''
//       Unexpected error!"
//     `)
//   })
//   it('if onFixup callback fails it errors gracefully', () => {
//     const onFixup = jest.fn().mockImplementation(() => {
//       throw new Error('Unexpected error!')
//     })
//     type d = { path: string }
//     const settings = S.create<d>({
//       onFixup,
//       spec: {
//         path: {
//           initial: c('/'),
//           fixup() {
//             return { value: 'foobar', messages: [] }
//           },
//         },
//       },
//     })
//     expect(() => settings.change({ path: '' })).toThrowErrorMatchingInlineSnapshot(`
//       "onFixup callback for \\"path\\" failed
//       Unexpected error!"
//     `)
//   })
//   it('if fixup returns null then onFixup is not called', () => {
//     const onFixup = jest.fn()
//     type d = { path: string }
//     const settings = S.create<d>({
//       onFixup,
//       spec: {
//         path: {
//           initial: c('/'),
//           fixup() {
//             return null
//           },
//         },
//       },
//     })
//     settings.change({ path: '' })
//     expect(onFixup.mock.calls).toEqual([])
//   })
//   it('initial does not pass through fixup', () => {
//     expect(
//       S.create<{ a: string }>({
//         spec: {
//           a: {
//             initial: c(''),
//             fixup() {
//               return { value: 'fixed', messages: [] }
//             },
//           },
//         },
//       }).data
//     ).toEqual({ a: '' })
//   })

//   it('defualt onFixup handler is to log a warning', () => {
//     log.settings({ filter: '*@warn' })
//     const settings = S.create<{ a: string }>({
//       spec: {
//         a: {
//           initial: c(''),
//           fixup() {
//             return { value: 'fixed', messages: ['...'] }
//           },
//         },
//       },
//     })
//     settings.change({ a: 'foo' })
//     expect(logs.mock.calls).toMatchInlineSnapshot(`
//       Array [
//         Array [
//           "{\\"event\\":\\"One of your setting values was invalid. We were able to automaticlaly fix it up now but please update your code.\\",\\"level\\":4,\\"path\\":[\\"settings\\"],\\"context\\":{\\"before\\":\\"foo\\",\\"after\\":\\"fixed\\",\\"name\\":\\"a\\",\\"messages\\":[\\"...\\"]}}
//       ",
//         ],
//       ]
//     `)
//   })
//   it('custom handler causes default to not run', () => {
//     log.settings({ filter: '*@warn' })
//     const settings = S.create<{ a: string }>({
//       onFixup() {},
//       spec: {
//         a: {
//           initial: c(''),
//           fixup() {
//             return { value: 'fixed', messages: ['...'] }
//           },
//         },
//       },
//     })
//     settings.change({ a: 'foo' })
//     expect(logs.mock.calls).toEqual([])
//   })
//   it('can call the original handler to retain the original base behaviour', () => {
//     log.settings({ filter: '*@warn' })
//     const settings = S.create<{ a: string }>({
//       onFixup(info, original) {
//         original(info)
//       },
//       spec: {
//         a: {
//           initial: c(''),
//           fixup() {
//             return { value: 'fixed', messages: ['...'] }
//           },
//         },
//       },
//     })
//     settings.change({ a: 'foo' })
//     expect(logs.mock.calls).toMatchInlineSnapshot(`
//       Array [
//         Array [
//           "{\\"event\\":\\"One of your setting values was invalid. We were able to automaticlaly fix it up now but please update your code.\\",\\"level\\":4,\\"path\\":[\\"settings\\"],\\"context\\":{\\"before\\":\\"foo\\",\\"after\\":\\"fixed\\",\\"name\\":\\"a\\",\\"messages\\":[\\"...\\"]}}
//       ",
//         ],
//       ]
//     `)
//   })
// })

// describe('validators', () => {
//   it('if a setting passes validation nothing happens', () => {
//     const validate = jest.fn().mockImplementation(() => null)
//     type d = { a: string }
//     const settings = S.create<d>({
//       spec: {
//         a: {
//           initial: c('foo'),
//           validate,
//         },
//       },
//     })
//     settings.change({ a: 'bar' })
//     expect(validate.mock.calls).toEqual([['bar']])
//   })
//   it('if a setting fails validation then an error is thrown', () => {
//     const validate = jest.fn().mockImplementation((value) => {
//       if (value === 'bar') {
//         return { messages: ['Too long', 'Too simple'] }
//       }
//     })
//     const settings = S.create<{ a: string }>({
//       spec: {
//         a: {
//           initial: c('foo'),
//           validate,
//         },
//       },
//     })
//     expect(() => settings.change({ a: 'bar' })).toThrowError(dedent`
//       Your setting "a" failed validation with value 'bar':

//       - Too long
//       - Too simple
//     `)
//   })
//   it('initial does not pass through validate', () => {
//     const validate = jest.fn().mockImplementation((value) => {
//       if (value === 'bad') {
//         return { messages: ['Too long', 'Too simple'] }
//       }
//     })
//     expect(
//       S.create<{ a: string }>({
//         spec: {
//           a: {
//             initial: c('bad'),
//             validate,
//           },
//         },
//       })
//     )
//   })
//   it('unexpected validator failures error gracefully', () => {
//     const validate = jest.fn().mockImplementation((value) => {
//       throw new Error('Unexpected error while trying to validate')
//     })
//     const settings = S.create<{ a: string }>({
//       spec: {
//         a: {
//           initial: c('foo'),
//           validate,
//         },
//       },
//     })
//     expect(() => settings.change({ a: 'bar' })).toThrowErrorMatchingInlineSnapshot(`
//       "Validation for \\"a\\" unexpectedly failed while running on value 'bar'
//       Unexpected error while trying to validate"
//     `)
//   })
// })

// describe('.reset()', () => {
//   it('returns api for chaining', () => {
//     const settings = S.create<{ a: string }>({ spec: { a: { initial: c('') } } })
//     expect(settings.reset()).toBe(settings)
//   })
//   it('resets settings data & metadata to initial state', () => {
//     const settings = S.create<{ a: string }>({ spec: { a: { initial: c('') } } })
//     settings.change({ a: 'foo' })
//     expect(settings.reset().data).toEqual({ a: '' })
//     expect(settings.reset().metadata).toEqual({ a: { from: 'initial', value: '', initial: '' } })
//   })
//   it('settings metadata & data references change', () => {
//     const settings = S.create<{ a: string }>({ spec: { a: { initial: c('') } } })
//     const originalMetadata = settings.metadata
//     const originalData = settings.data
//     settings.reset()
//     expect(settings.data).not.toBe(originalData)
//     expect(settings.metadata).not.toBe(originalMetadata)
//   })
//   it('dynamic initializers are re-run', () => {
//     process.env.foo = 'foo'
//     const settings = S.create<{ a: string }>({ spec: { a: { initial: () => process.env.foo! } } })
//     process.env.foo = 'bar'
//     expect(settings.reset().metadata).toEqual({ a: { from: 'initial', value: 'bar', initial: 'bar' } })
//     delete process.env.foo
//   })
// })

// describe('.original()', () => {
//   it('gets the settings as they were initially', () => {
//     const settings = S.create<{ a: { a: string }; b: { a: number } }>({
//       spec: {
//         a: { fields: { a: { initial: () => 'foo' } } },
//         b: { fields: { a: { initial: () => 1 } } },
//       },
//     })
//     const original = Lo.cloneDeep(settings.data)
//     settings.change({ a: { a: 'bar' }, b: { a: 2 } })
//     expect(settings.original()).toEqual(original)
//   })
// })

// describe('metadata', () => {
//   it('tracks if a setting value comes from its initializer', () => {
//     const settings = S.create<{ a: string }>({
//       spec: {
//         a: {
//           initial: c('foo'),
//         },
//       },
//     })
//     expect(settings.metadata).toEqual({ a: { from: 'initial', value: 'foo', initial: 'foo' } })
//   })
//   it('traces if a setting value comes from change input', () => {
//     const settings = S.create<{ a: string }>({
//       spec: {
//         a: {
//           initial: c('foo'),
//         },
//       },
//     })
//     expect(settings.change({ a: 'bar' }).metadata).toEqual({
//       a: { from: 'set', value: 'bar', initial: 'foo' },
//     })
//   })
//   it('models namespaces', () => {
//     const settings = S.create<{ a: { a: string } }>({
//       spec: {
//         a: {
//           fields: {
//             a: {
//               initial: c('foo'),
//             },
//           },
//         },
//       },
//     })
//     expect(settings.metadata).toEqual({
//       a: { fields: { a: { from: 'initial', value: 'foo', initial: 'foo' } } },
//     })
//   })
// })

// describe('value merging', () => {
//   it('changing an array setting replaces the existing array', () => {
//     const settings = S.create<{ a: string[] }>({ spec: { a: { initial: c(['foo']) } } })
//     expect(settings.change({ a: ['bar'] }).data).toEqual({ a: ['bar'] })
//   })
// })

/**
 * Helpers
 */

/**
 * Create a constant function
 */
const c = <T>(x: T) => () => x
