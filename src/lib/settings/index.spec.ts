import * as Settings from './'

describe('static typing', () => {
  it.todo('if no input type given it defaults to deep partial version of the data type')
  it.todo(
    'if a namespace in the input type is a union with non-object types then it forces the specifier to have a shorthand'
  )
})

describe('initializers', () => {
  it('initializers may be static', () => {
    type d = { a: string }
    const settings = Settings.create<d>({ a: { initial: 'foobar' } })
    expect(settings.data.a).toEqual('foobar')
  })

  it('initializers may be dynamic, they are resolved at create time', () => {
    type d = { a: string }
    const settings = Settings.create<d>({ a: { initial: () => 'foobar' } })
    expect(settings.data.a).toEqual('foobar')
  })
  it('if the setting datum is optional then the setting initializer can be omited', () => {
    type d = { a?: string }
    const settings = Settings.create<d>({ a: {} })
    expect(settings.data.a).toEqual(undefined)
  })

  it('if the setting datum is optional then the dynamic setting initializer can return undefined', () => {
    type d = { a?: string }
    const settings = Settings.create<d>({
      a: {
        initial() {
          return undefined
        },
      },
    })
    expect(settings.data.a).toEqual(undefined)
  })
})

it('a setting may be a namespace holding more settings', () => {
  type d = { a: { b: string } }
  const settings = Settings.create<d>({ a: { fields: { b: { initial: '' } } } })
  expect(settings.data.a.b).toEqual('')
})

it.todo('a namespace may be optional')

it('a namespace may have a shorthand', () => {
  type d = { a: { b: string } }
  type i = { a: string | { b: string } }
  const settings = Settings.create<d, i>({
    a: {
      shorthand(value) {
        return { b: value + ' via shorthand!' }
      },
      fields: { b: { initial: '' } },
    },
  })
  expect(settings.data.a.b).toEqual('')
  expect(settings.change({ a: 'some change' }).data.a).toEqual({ b: 'some change via shorthand!' })
})

it('a namespace with a shorthand still accepts non-shorthand input', () => {
  type d = { a: { b: string } }
  type i = { a: string | { b: string } }
  const settings = Settings.create<d, i>({
    a: {
      shorthand(value) {
        return { b: value + ' via shorthand!' }
      },
      fields: { b: { initial: '' } },
    },
  })
  expect(settings.change({ a: { b: 'direct' } }).data.a).toEqual({ b: 'direct' })
})

it('a namespace shorthand can receive input that is not directly in the final data', () => {
  type d = { a: { b: string } }
  type i = { a: (() => number) | { b: string } }
  const settings = Settings.create<d, i>({
    a: {
      shorthand(f) {
        return { b: f().toString() }
      },
      fields: { b: { initial: '' } },
    },
  })
  expect(settings.change({ a: () => 1 }).data).toEqual({ a: { b: '1' } })
})

describe('runtime errors', () => {
  it('giving shorthand to a namespace that does not support it will error gracefully', () => {
    type d = { a: { b: string } }
    const settings = Settings.create<d, any>({ a: { fields: { b: { initial: '' } } } })
    expect(() => settings.change({ a: 'runtime error' })).toThrowErrorMatchingInlineSnapshot(
      `"Setting \\"a\\" is a namespace with no shorthand so expects an object but received a non-object: 'runtime error'"`
    )
  })

  it('giving object to a non-namespace will error gracefully', () => {
    type d = { a: string }
    const settings = Settings.create<d, any>({ a: { initial: '' } })
    expect(() => settings.change({ a: { b: '' } })).toThrowErrorMatchingInlineSnapshot(
      `"Setting \\"a\\" is not a namespace and so does not accept objects, but one given: { b: '' }"`
    )
  })

  it('changing settings that do not exist will error gracefully', () => {
    type d = { a: string }
    const settings = Settings.create<d, any>({ a: { initial: '' } })
    expect(() => settings.change({ z: '' })).toThrowErrorMatchingInlineSnapshot(
      `"Could not find a setting specifier for setting \\"z\\""`
    )
  })
})

it('a setting can be changed', () => {
  type d = { a: string }
  const settings = Settings.create<d>({ a: { initial: 'a' } })
  expect(settings.change({ a: 'a2' }).data).toEqual({ a: 'a2' })
})

it('a namespaced setting can be changed', () => {
  type d = { a: { b: string } }
  const settings = Settings.create<d>({ a: { fields: { b: { initial: 'b' } } } })
  expect(settings.change({ a: { b: 'b2' } }).data).toEqual({ a: { b: 'b2' } })
})

it('changing namespaced settings merges deeply preserving existing settings not targetted by the change', () => {
  type d = { a: { a: string; b: number }; b: number }
  const settings = Settings.create<d>({
    a: {
      fields: {
        b: { initial: 1 },
        a: { initial: 'a' },
      },
    },
    b: { initial: 1 },
  })
  expect(settings.change({ a: { a: 'a2' } }).data).toEqual({ a: { a: 'a2', b: 1 }, b: 1 })
})

it.todo('a setting can be fixed up')
it.todo('a setting can be validated')
it.todo('changing an array setting appends to the existing array')

describe('reset', () => {
  it.todo('resets settings to initial state')
  it.todo('dynamic initializers are re-run')
})

describe('metadata', () => {
  it.todo('tracks if a setting value comes from its initializer')
  it.todo('traces if a setting value comes from change input')
})
