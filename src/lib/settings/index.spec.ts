import * as Settings from './'

type d = { a: string }

it('initializers may be static', () => {
  const settings = Settings.create<d, any>({ a: { initial: 'foobar' } })
  expect(settings.data.a).toEqual('foobar')
})

it('initializers may be dynamic, they are resolved at create time', () => {
  const settings = Settings.create<d, any>({ a: { initial: () => 'foobar' } })
  expect(settings.data.a).toEqual('foobar')
})

it('a setting may be a namespace holding more settings', () => {
  type d = { a: { b: string } }
  const settings = Settings.create<d, any>({ a: { fields: { b: { initial: '' } } } })
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

describe('runtime errors', () => {
  it('giving shorthand to a namespace that does not support it will error gracefully', () => {
    type d = { a: { b: string } }
    type i = { a: string | { b: string } }
    const settings = Settings.create<d, i>({
      a: {
        fields: { b: { initial: '' } },
      },
    })
    expect(() => settings.change({ a: 'runtime error' })).toThrowErrorMatchingInlineSnapshot(
      `"Setting \\"a\\" is a namespace with no shorthand so expects an object but received a non-object: 'runtime error'"`
    )
  })

  it('giving object to a non-namespace will error gracefully', () => {
    type d = { a: string }
    const settings = Settings.create<d, any>({
      a: { initial: '' },
    })
    expect(() => settings.change({ a: { b: '' } })).toThrowErrorMatchingInlineSnapshot(
      `"Setting \\"a\\" is not a namespace and so does not accept objects, but one given: { b: '' }"`
    )
  })

  it('giving settings to change that do not exist will error gracefully', () => {
    type d = { a: string }
    const settings = Settings.create<d, any>({
      a: { initial: '' },
    })
    expect(() => settings.change({ z: '' })).toThrowErrorMatchingInlineSnapshot(
      `"Could not find a setting specifier for setting \\"z\\""`
    )
  })
})

it('if the data is optional then the setting initializer can be omited', () => {
  type d = { a?: string }
  const settings = Settings.create<d, any>({ a: {} })
  expect(settings.data.a).toEqual(undefined)
})

it.todo('if the setting data is optional then the setting initializer can return undefined')
it.todo('a namespaced setting can be changed')
it.todo('a namespace can support shorthand input that is not represented in the final data')
it.todo('a setting can be fixed up')
it.todo('a setting can be validated')

describe('reset', () => {
  it.todo('resets settings to initial state')
  it.todo('dynamic initializers are re-run')
})
