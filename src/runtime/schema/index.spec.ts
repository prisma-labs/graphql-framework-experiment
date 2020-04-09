import { plugin } from '@nexus/schema'
import { create } from './schema'
import { mapSettingsToNexusSchemaConfig } from './settings'

let schema: ReturnType<typeof create>

beforeEach(() => {
  schema = create()
})

it('defaults to outputs being nullable by default', () => {
  expect(mapSettingsToNexusSchemaConfig([], schema.private.settings.data).nonNullDefaults?.output).toEqual(
    false
  )
})

it('defaults to inputs being nullable by defualt', () => {
  expect(mapSettingsToNexusSchemaConfig([], schema.private.settings.data).nonNullDefaults?.input).toEqual(
    false
  )
})

it('inputs can be made required by default', () => {
  schema.private.settings.change({ nullable: { inputs: false } })
  expect(mapSettingsToNexusSchemaConfig([], schema.private.settings.data).nonNullDefaults?.input).toEqual(
    true
  )
})

it('outputs can be made guaranteed by default', () => {
  schema.private.settings.change({ nullable: { outputs: false } })
  expect(mapSettingsToNexusSchemaConfig([], schema.private.settings.data).nonNullDefaults?.output).toEqual(
    true
  )
})

describe('use', () => {
  it('incrementally adds plugins', () => {
    schema.public.use(plugin({ name: 'foo' }))
    schema.public.use(plugin({ name: 'bar' }))
    expect(schema.private.state.schemaPlugins.length).toEqual(2)
  })
})
