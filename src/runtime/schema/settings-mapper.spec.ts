import { createSchemaSettingsManager, SchemaSettingsManager } from './settings'
import { mapSettingsAndPluginsToNexusSchemaConfig } from './settings-mapper'

let sd: SchemaSettingsManager['data']

beforeEach(() => {
  sd = createSchemaSettingsManager().data
})

it('inputs can be made required by default', () => {
  sd.nullable.inputs = false
  expect(mapSettingsAndPluginsToNexusSchemaConfig([], sd).nonNullDefaults?.input).toEqual(true)
})

it('outputs can be made guaranteed by default', () => {
  sd.nullable.outputs = false
  expect(mapSettingsAndPluginsToNexusSchemaConfig([], sd).nonNullDefaults?.output).toEqual(true)
})
