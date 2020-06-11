import { createSchemaSettingsManager, SchemaSettingsManager } from './settings'

let sm: SchemaSettingsManager

beforeEach(() => {
  sm = createSchemaSettingsManager()
})

it('has defaults', () => {
  expect(sm.data).toMatchInlineSnapshot(`
    Object {
      "connections": Object {
        "default": Object {
          "nexusFieldName": "connection",
          "nexusSchemaImportId": "nexus/components/schema",
        },
      },
      "generateGraphQLSDLFile": "api.graphql",
      "nullable": Object {
        "inputs": true,
        "outputs": true,
      },
      "rootTypingsGlobPattern": "./**/*.ts",
    }
  `)
})
