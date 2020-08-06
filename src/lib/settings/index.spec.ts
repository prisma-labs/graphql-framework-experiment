import 'jest-extended'
import * as tsd from 'tsd'
import * as S from './'

describe('input field specifiers', () => {
  describe('encounter static errors', () => {
    it('if missing for a fields in the input type', () => {
      S.create<{ a: number }>({ spec: { a: {} } })
      // @ts-expect-error
      S.create<{ a: number }>({ spec: {} })
    })
  })
  describe('with optional data type', () => {
    it('can be omitted', () => {
      const s = S.create<{ a: number }, { a?: number }>({ spec: {} })
      expect(s.data.a).toBeUndefined()
    })
    it('can still be provided too', () => {
      const s = S.create<{ a: number }, { a?: number }>({ spec: { a: {} } })
      expect(s.data.a).toBeUndefined()
    })
  })
})

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
        'There was an unexpected error while running the initializer for setting "a" \nUnexpected error while trying to initialize setting'
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
    // prettier-ignore
    it('boolean, number, string, literal', () => {
      expect(S.create<{ a?: boolean }>({ spec: { a: { initial: c(true) } } }).data.a).toEqual(true)
      expect(S.create<{ a?: number }>({ spec: { a: { initial: c(1) } } }).data.a).toEqual(1)
      expect(S.create<{ a?: 2 }>({ spec: { a: { initial: c(2) } } }).data.a).toEqual(2)
      expect(S.create<{ a?: string }>({ spec: { a: { initial: c('a') } } }).data.a).toEqual('a')
    })
  })
})

describe('validation', () => {
  it('if mapType is assigned non-function', () => {
    expect(() => {
      // @ts-expect-error
      S.create<{ a: number }, { a: boolean }>({ spec: { a: { mapType: 1 } } })
    }).toThrowError('Type mapper for setting "a" was invalid. Type mappers must be functions. Got: 1')
  })
  it('if mapType is assigned non-function (record)', () => {
    expect(() => {
      // prettier-ignore
      // @ts-expect-error
      S.create<{ a: Record<string, {b:1}> }, { a: Record<string, {b:2}> }>({ spec: { a: { entryFields: { b: { mapType: 1 } } } } })
    }).toThrowError('Type mapper for setting "b" was invalid. Type mappers must be functions. Got: 1')
  })
})

describe('input field type mappers', () => {
  it('do not relate to the optionality of the input or the data', () => {
    // show that  mapType is still an required
    S.create<{ a?: number }, { a: boolean }>({
      spec: { a: { mapType: (a) => Boolean(a), initial: () => 1 } },
    })
    S.create<{ a: number }, { a?: boolean }>({ spec: { a: { mapType: (a) => a === 1 } } })
    // show that missing mapType is still an error
    // @ts-expect-error
    S.create<{ a?: number }, { a: boolean }>({ spec: { a: { initial: () => 1 } } })
    // @ts-expect-error
    S.create<{ a: number }, { a?: boolean }>({ spec: { a: {} } })
  })
  describe('receive one parameter containing the input that is', () => {
    it('not optional', () => {
      //prettier-ignore
      S.create<{ a: number }, { a: boolean }>({ spec: { a: { mapType: (a) => { tsd.expectType<number>(a); return true } } } })
    })
    it('not optional even if input field is optional', () => {
      //prettier-ignore
      S.create<{ a?: number }, { a: boolean }>({ spec: { a: { mapType: (a) => { tsd.expectType<number>(a); return true }, initial: () => 1 } } })
    })
  })
  describe('return type', () => {
    it('includes undefined if data is optionl', () => {
      S.create<{ a: number }, { a?: boolean }>({ spec: { a: { mapType: () => undefined } } })
    })
  })
  describe('at construction time', () => {
    it('maps the initial value to its data value', () => {
      const s = S.create<{ a?: number }, { a: boolean }>({
        spec: { a: { initial: () => 1, mapType: (n) => n === 1 } },
      })
      expect(s.data.a).toEqual(true)
    })
    it('gracefully throws if unexpectedly fail', () => {
      expect(() => {
        //prettier-ignore
        S.create<{ a: number }, { a?: boolean }>({ spec: { a: { mapType() { throw new Error('Oops') } } } })
      }).toThrowError('There was an unexpected error while running the type mapper for setting "a" \nOops')
    })
  })
  describe('at change time', () => {
    it('maps the changed value to its data value', () => {
      // prettier-ignore
      const s = S.create<{ a?: number }, { a: boolean }>({ spec: { a: { initial: () => 1, mapType: (n) => n === 1 } } })
      s.change({ a: 2 })
      expect(s.data.a).toEqual(false)
    })
    it('gracefully throws if unexpectedly fail', () => {
      //prettier-ignore
      const mapType = jest.fn().mockImplementationOnce(() => true).mockImplementation(() => { throw new Error('Oops') })
      expect(() => {
        //prettier-ignore
        const s = S.create<{ a: number }, { a?: boolean }>({ spec: { a: { mapType } } })
        s.change({ a: 2 })
      }).toThrowError('There was an unexpected error while running the type mapper for setting "a" \nOops')
    })
  })
  describe('encounter static errors', () => {
    it('are required when input type is not assignable to data type', () => {
      S.create<{ a: number }, { a: boolean }>({ spec: { a: { mapType: (a) => Boolean(a) } } })
      // @ts-expect-error
      S.create<{ a: number }, { a: boolean }>({ spec: { a: {} } })
    })
    it('are forbidden when the input type is assignable to data type', () => {
      // @ts-expect-error
      S.create<{ a: number }, { a: number }>({ spec: { a: { mapType: (a) => Boolean(a) } } })
    })
    it('must return a type assignable to the field data', () => {
      // @ts-expect-error
      S.create<{ a: number }, { a: boolean }>({ spec: { a: { mapType: () => 1 } } })
    })
  })
})

describe('namespaces', () => {
  describe('static errors', () => {
    it('a field requires an initializer if the input is optional', () => {
      S.create<{ a?: { b?: 1 } }>({ spec: { a: { fields: { b: { initial: c(1) } } } } })
      // @ts-expect-error
      S.create<{ a?: { b?: 1 } }>({ spec: { a: { fields: { b: {} } } } })
    })
    it('a field cannot have an initializer if the input is required', () => {
      S.create<{ a: { b: 1 } }>({ spec: { a: { fields: { b: {} } } } })
      // @ts-expect-error
      S.create<{ a: { b: 1 } }>({ spec: { a: { fields: { b: { initial: c(1) } } } } })
    })
    it('if the namespace is optional but its fields are required then namespace must have initializer', () => {
      S.create<{ a?: { b: 1 } }>({ spec: { a: { initial: c({ b: 1 }), fields: { b: {} } } } })
      // @ts-expect-error missing a.initial
      S.create<{ a?: { b: 1 } }>({ spec: { a: { fields: { b: {} } } } })
    })
    it('namespace initializer only needs to return required fields', () => {
      S.create<{ a?: { b: 1; c?: 2 } }>({
        spec: { a: { initial: c({ b: 1 }), fields: { b: {}, c: { initial: c(2) } } } },
      })
      // @ts-expect-error missing initializer
      S.create<{ a?: { b: 1; c?: 2 } }>({ spec: { a: { initial: c({ b: 1 }), fields: { b: {}, c: {} } } } })
      // prettier-ignore
      // @ts-expect-error missing required fields in namespace initializer
      S.create<{ a?: { b: 1; c?: 2 } }>({ spec: { a: { initial: c({}), fields: { b: {}, c: { initial: c(2) } } } } })
    })
  })
  it('namespace initializer initializes its data', () => {
    const s = S.create<{ a?: { b: 1 } }>({ spec: { a: { initial: c({ b: 1 }), fields: { b: {} } } } })
    expect(s.data).toEqual({ a: { b: 1 } })
  })
  it('namespace initializer statically (todo) cannot provide optional fields and if it does are overriden by the field initializer', () => {
    // todo this should raise a compiler warning but it does not because of https://github.com/microsoft/TypeScript/issues/241#issuecomment-669138047
    // @ ts-expect-error c prop forbidden from namespace initializer
    // prettier-ignore
    const s = S.create<{ a?: { b: 1, c?: number } }>({ spec: { a: { log:{b:1,c:2}, log2: {b:1,c:2}, initial(){ return { b:1, c: 3 } }, fields: { b: {}, c:{initial: c(2) } } } } })
    expect(s.data).toEqual({ a: { b: 1, c: 2 } })
  })
  it('a field initializer initializes its data', () => {
    const settings = S.create<{ a?: { b?: 1 } }>({ spec: { a: { fields: { b: { initial: c(1) } } } } })
    expect(settings.data.a.b).toEqual(1)
  })
  it('data can be changed', () => {
    const settings = S.create<{ a?: { b?: number } }>({ spec: { a: { fields: { b: { initial: c(1) } } } } })
    expect(settings.change({ a: { b: 2 } }).data).toEqual({ a: { b: 2 } })
  })
  it('data merges deeply preserving existing data not targetted by input', () => {
    const settings = S.create<{ a?: { a?: number; b?: number }; b?: number }>({
      spec: {
        a: { fields: { a: { initial: c(1) }, b: { initial: c(2) } } },
        b: { initial: c(3) },
      },
    })
    expect(settings.change({ a: { a: 4 } }).data).toEqual({ a: { a: 4, b: 2 }, b: 3 })
  })
  it('passing a plain object to a non-namespace field will error gracefully', () => {
    const s = S.create<{ a?: 1 }>({ spec: { a: { initial: c(1) } } })
    // @ts-expect-error
    expect(() => s.change({ a: { b: 2 } })).toThrowErrorMatchingInlineSnapshot(
      `"Setting \\"a\\" is not a namespace and so does not accept objects, but one given: { b: 2 }"`
    )
  })
  describe('with shorthands', () => {
    it('allow a value to be assigned directly to the namespace field', () => {
      type i = { a?: number | { b?: number } }
      type d = { a: { b: number } }
      const settings = S.create<i, d>({
        // prettier-ignore
        spec: { a: { shorthand: (value) => ({ b: value + 100 }), fields: { b: { initial: c(1) } } } }
      })
      expect(settings.data).toEqual({ a: { b: 1 } })
      expect(settings.change({ a: 2 }).data).toEqual({ a: { b: 102 } })
    })
    describe('runtime errors', () => {
      it('unexpected shorthand errors fail gracefully', () => {
        type d = { a: { b: number } }
        type i = { a: number | { b: number } }
        // prettier-ignore
        const settings = S.create<i, d>({ spec: { a: { shorthand(value) { throw new Error(`Unexpected shorthand error with value ${value}`) }, fields: { b: { initial: c('') } } } } })
        expect(() => settings.change({ a: 100 }).data.a).toThrowError(
          'There was an unexpected error while running the namespace shorthand for setting "a". The given value was 100 \nUnexpected shorthand error with value 100'
        )
      })
    })
    it('still accepts longhand input', () => {
      type d = { a: { b: number } }
      type i = { a: number | { b: number } }
      const settings = S.create<i, d>({
        // prettier-ignore
        spec: { a: { shorthand: (n) => ({ b: n + 100 }) , fields: { b: { initial: c(1) } } } }
      })
      expect(settings.change({ a: { b: 3 } }).data.a).toEqual({ b: 3 })
    })
    it('can be a type that differs from the longhand', () => {
      type i = { a: (() => number) | { b: string } }
      type d = { a: { b: string } }
      const settings = S.create<i, d>({
        // prettier-ignore
        spec: { a: { shorthand: (f) => ({ b: f().toString() }), fields: { b: {} } } }
      })
      expect(settings.change({ a: () => 1 }).data).toEqual({ a: { b: '1' } })
    })
    it('if input/data types differ and shorthand used the type mapper receives the expanded input', () => {
      // prettier-ignore
      const settings = S.create<{ a: string | { b: string } }, { a: { b: number } }>({
        spec: { a: {
          shorthand: (s) => ({b:s}),
          fields: { b: { mapType(v) { tsd.expectType<string>(v); return Number(v) } } } } }
      })
      expect(settings.change({ a: '1' }).data).toEqual({ a: { b: 1 } })
    })
    it('changing with a shorthand on a namespace that does not support them will error gracefully', () => {
      const settings = S.create<{ a: { b: string } }>({ spec: { a: { fields: { b: {} } } } })
      // @ts-expect-error
      expect(() => settings.change({ a: 'runtime error' })).toThrowError(
        'Setting "a" is a namespace with no shorthand so expects an object but received a non-object: \'runtime error\''
      )
    })
  })
})

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
