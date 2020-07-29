import * as Settings from './'

describe('static typing', () => {
  it.todo('if no input type given it defaults to deep partial version of the data type')
  it.todo(
    'if a namespace in the input type is a union with non-object types then it forces the specifier to have a shorthand'
  )
})

describe('data initializers', () => {
  it.todo('if initial has unexpected error it fails gracefully')
  it('initializers may be static', () => {
    type d = { a: string }
    const settings = Settings.create<d>({ spec: { a: { initial: 'foobar' } } })
    expect(settings.data.a).toEqual('foobar')
  })

  it('initializers may be dynamic, they are resolved at create time', () => {
    type d = { a: string }
    const settings = Settings.create<d>({ spec: { a: { initial: () => 'foobar' } } })
    expect(settings.data.a).toEqual('foobar')
  })
  it('if the setting datum is optional then the setting initializer can be omited', () => {
    type d = { a?: string }
    const settings = Settings.create<d>({ spec: { a: {} } })
    expect(settings.data.a).toEqual(undefined)
  })

  it('if the setting datum is optional then the dynamic setting initializer can return undefined', () => {
    type d = { a?: string }
    const settings = Settings.create<d>({
      spec: {
        a: {
          initial() {
            return undefined
          },
        },
      },
    })
    expect(settings.data.a).toEqual(undefined)
  })
})

it('a setting may be a namespace holding more settings', () => {
  type d = { a: { b: string } }
  const settings = Settings.create<d>({ spec: { a: { fields: { b: { initial: '' } } } } })
  expect(settings.data.a.b).toEqual('')
})

describe('namespaced settings', () => {
  it('a namespaced setting can be changed', () => {
    type d = { a: { b: string } }
    const settings = Settings.create<d>({ spec: { a: { fields: { b: { initial: 'b' } } } } })
    expect(settings.change({ a: { b: 'b2' } }).data).toEqual({ a: { b: 'b2' } })
  })
  it.todo('a namespace may be optional')
  it('changing namespaced settings merges deeply preserving existing settings not targetted by the change', () => {
    type d = { a: { a: string; b: number }; b: number }
    const settings = Settings.create<d>({
      spec: {
        a: {
          fields: {
            b: { initial: 1 },
            a: { initial: 'a' },
          },
        },
        b: { initial: 1 },
      },
    })
    expect(settings.change({ a: { a: 'a2' } }).data).toEqual({ a: { a: 'a2', b: 1 }, b: 1 })
  })
  it('giving object to a non-namespace will error gracefully', () => {
    type d = { a: string }
    const settings = Settings.create<d, any>({ spec: { a: { initial: '' } } })
    expect(() => settings.change({ a: { b: '' } })).toThrowErrorMatchingInlineSnapshot(
      `"Setting \\"a\\" is not a namespace and so does not accept objects, but one given: { b: '' }"`
    )
  })
})

describe('namespace shorthands', () => {
  it.todo('unexpected shorthand errors fail gracefully')
  it('a namespace may have a shorthand', () => {
    type d = { a: { b: string } }
    type i = { a: string | { b: string } }
    const settings = Settings.create<d, i>({
      spec: {
        a: {
          shorthand(value) {
            return { b: value + ' via shorthand!' }
          },
          fields: { b: { initial: '' } },
        },
      },
    })
    expect(settings.data.a.b).toEqual('')
    expect(settings.change({ a: 'some change' }).data.a).toEqual({ b: 'some change via shorthand!' })
  })

  it('a namespace with a shorthand still accepts non-shorthand input', () => {
    type d = { a: { b: string } }
    type i = { a: string | { b: string } }
    const settings = Settings.create<d, i>({
      spec: {
        a: {
          shorthand(value) {
            return { b: value + ' via shorthand!' }
          },
          fields: { b: { initial: '' } },
        },
      },
    })
    expect(settings.change({ a: { b: 'direct' } }).data.a).toEqual({ b: 'direct' })
  })
  it('a namespace shorthand can receive input that is not directly in the final data', () => {
    type d = { a: { b: string } }
    type i = { a: (() => number) | { b: string } }
    const settings = Settings.create<d, i>({
      spec: {
        a: {
          shorthand(f) {
            return { b: f().toString() }
          },
          fields: { b: { initial: '' } },
        },
      },
    })
    expect(settings.change({ a: () => 1 }).data).toEqual({ a: { b: '1' } })
  })
  it('giving shorthand to a namespace that does not support it will error gracefully', () => {
    type d = { a: { b: string } }
    const settings = Settings.create<d, any>({ spec: { a: { fields: { b: { initial: '' } } } } })
    expect(() => settings.change({ a: 'runtime error' })).toThrowErrorMatchingInlineSnapshot(
      `"Setting \\"a\\" is a namespace with no shorthand so expects an object but received a non-object: 'runtime error'"`
    )
  })
})

describe('runtime errors', () => {
  it('changing settings that do not exist will error gracefully', () => {
    type d = { a: string }
    const settings = Settings.create<d, any>({ spec: { a: { initial: '' } } })
    expect(() => settings.change({ z: '' })).toThrowErrorMatchingInlineSnapshot(
      `"Could not find a setting specifier for setting \\"z\\""`
    )
  })
})

it('a setting can be changed', () => {
  type d = { a: string }
  const settings = Settings.create<d>({ spec: { a: { initial: 'a' } } })
  expect(settings.change({ a: 'a2' }).data).toEqual({ a: 'a2' })
})

describe('fixups', () => {
  it('a setting can be fixed up', () => {
    const onFixup = jest.fn()
    type d = { path: string }
    const settings = Settings.create<d>({
      onFixup,
      spec: {
        path: {
          initial: '/foo',
          fixup(value) {
            if (value[0] === '/') return null
            return { messages: ['must have leading slash'], value: `/${value}` }
          },
        },
      },
    })
    expect(settings.change({ path: 'foo' }).data).toEqual({ path: '/foo' })
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
            ],
          ]
      `)
  })
  it('a namespace with shorthand runs through fixups too', () => {
    const onFixup = jest.fn()
    type d = { path: string | { to: string } }
    const settings = Settings.create<d>({
      onFixup,
      spec: {
        path: {
          shorthand(value) {
            return { to: value }
          },
          fields: {
            to: {
              initial: '/foo',
              fixup(value) {
                if (value[0] === '/') return null
                return { messages: ['must have leading slash'], value: `/${value}` }
              },
            },
          },
        },
      },
    })
    expect(settings.change({ path: 'foo' }).data).toEqual({ path: { to: '/foo' } })
    expect(onFixup.mock.calls).toMatchInlineSnapshot(`
      Array [
        Array [
          Object {
            "after": "/foo",
            "before": "foo",
            "messages": Array [
              "must have leading slash",
            ],
            "name": "to",
          },
        ],
      ]
    `)
  })
  it('if fixup fails it errors gracefully', () => {
    type d = { path: string }
    const settings = Settings.create<d>({
      spec: {
        path: {
          initial: '/',
          fixup() {
            throw new Error('Unexpected error!')
          },
        },
      },
    })
    expect(() => settings.change({ path: '' })).toThrowErrorMatchingInlineSnapshot(`
      "Fixup for \\"path\\" failed while running on value '':
      Error: Unexpected error!"
    `)
  })
  it('if onFixup callback fails it errors gracefully', () => {
    const onFixup = jest.fn().mockImplementation(() => {
      throw new Error('Unexpected error!')
    })
    type d = { path: string }
    const settings = Settings.create<d>({
      onFixup,
      spec: {
        path: {
          initial: '/',
          fixup() {
            return { value: 'foobar', messages: [] }
          },
        },
      },
    })
    expect(() => settings.change({ path: '' })).toThrowErrorMatchingInlineSnapshot(`
      "onFixup callback for \\"path\\" failed:
      Error: Unexpected error!"
    `)
  })
  it('if fixup returns null then onFixup is not called', () => {
    const onFixup = jest.fn()
    type d = { path: string }
    const settings = Settings.create<d>({
      onFixup,
      spec: {
        path: {
          initial: '/',
          fixup() {
            return null
          },
        },
      },
    })
    settings.change({ path: '' })
    expect(onFixup.mock.calls).toEqual([])
  })
})

describe('validators', () => {
  it.todo('a setting can be validated')
  it.todo('changing an array setting appends to the existing array')
})

describe('reset', () => {
  it.todo('resets settings to initial state')
  it.todo('dynamic initializers are re-run')
})

describe('metadata', () => {
  it('tracks if a setting value comes from its initializer', () => {
    type d = { a: string }
    const settings = Settings.create<d>({
      spec: {
        a: {
          initial: 'foo',
        },
      },
    })
    expect(settings.metadata.a).toEqual({ from: 'initial', value: 'foo' })
  })
  it('traces if a setting value comes from change input', () => {
    type d = { a: string }
    const settings = Settings.create<d>({
      spec: {
        a: {
          initial: 'foo',
        },
      },
    })
    expect(settings.change({ a: 'bar' }).metadata.a).toEqual({ from: 'set', value: 'bar' })
  })
})
