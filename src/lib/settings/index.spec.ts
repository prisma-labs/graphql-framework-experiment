import * as Settings from './'

it('setting initializers are run at create time', () => {
  const settings = Settings.create<{ a: string }, { a: string }>({ a: { initial: () => 'foobar' } })
  expect(settings.data.a).toEqual('foobar')
})

it.todo('if the setting data is optional then the setting initializer can be omited')
it.todo('if the setting data is optional then the setting initializer can return undefined')
it.todo('a namespaced setting can be changed')
it.todo('a namespace can support shorthand input that is not represented in the final data')
it.todo('a setting can be fixed up')
it.todo('a setting can be validated')
