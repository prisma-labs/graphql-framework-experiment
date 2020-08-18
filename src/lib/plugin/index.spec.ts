import { isLeft } from 'fp-ts/lib/Either'
import * as Path from 'path'
import * as TC from '../test-context'
import { normalizePathsInData } from '../utils'
import { importAndLoadTesttimePlugins } from './load'
import { getPluginManifest } from './manifest'
import { Dimension, Plugin, PluginWithoutSettings } from './types'

const ctx = TC.create(TC.tmpDir(), TC.fs())

describe('manifest', () => {
  let plugin: Plugin
  const run = () => normalizePathsInData(getPluginManifest(plugin), ctx.tmpDir, '<project root>')

  it('processes the manifest input with defaults', () => {
    ctx.fs.write('package.json', `{ "name": "foo", "main": "./dist/index.js" }`)
    plugin = {
      packageJsonPath: Path.join(ctx.tmpDir, 'package.json'),
    }
    expect(run()).toMatchInlineSnapshot(`
      Object {
        "_tag": "Right",
        "right": Object {
          "name": "foo",
          "packageJson": Object {
            "main": "./dist/index.js",
            "name": "foo",
          },
          "packageJsonPath": "<project root>/package.json",
          "runtime": null,
          "settings": null,
          "testtime": null,
          "worktime": null,
        },
      }
    `)
  })

  it('fails if package.json was not where it manifest input said it would be', () => {
    plugin = { packageJsonPath: Path.join(ctx.tmpDir, 'package.json') }
    expect(run()).toMatchInlineSnapshot(`
      Object {
        "_tag": "Left",
        "left": Object {
          "context": Object {
            "plugin": Object {
              "packageJsonPath": "<project root>/package.json",
            },
            "reason": "Failed to read the the package.json file.

      Error: Cannot find module '<project root>/package.json' from 'src/lib/plugin/manifest.ts'",
          },
          "type": "get_manifest_error",
        },
      }
    `)
  })

  it('fails if name is not present in package file', () => {
    ctx.fs.write('package.json', `{ "main": "./dist/index.js" }`)
    plugin = { packageJsonPath: Path.join(ctx.tmpDir, 'package.json') }
    expect(run()).toMatchInlineSnapshot(`
      Object {
        "_tag": "Left",
        "left": Object {
          "context": Object {
            "name": undefined,
            "plugin": Object {
              "packageJsonPath": "<project root>/package.json",
            },
            "reason": "\`name\` property is missing in the package.json",
          },
          "type": "get_manifest_error",
        },
      }
    `)
  })

  it('fails if main is not present in package file', () => {
    ctx.fs.write('package.json', `{ "name": "foo" }`)
    plugin = { packageJsonPath: Path.join(ctx.tmpDir, 'package.json') }
    expect(run()).toMatchInlineSnapshot(`
      Object {
        "_tag": "Left",
        "left": Object {
          "context": Object {
            "name": "foo",
            "plugin": Object {
              "packageJsonPath": "<project root>/package.json",
            },
            "reason": "\`main\` property is missing in the package.json",
          },
          "type": "get_manifest_error",
        },
      }
    `)
  })
})

function stubPlugin(dimension: Dimension, exportName: string): [PluginWithoutSettings] {
  return [
    {
      packageJsonPath: require.resolve('../../../package.json'),
      [dimension]: {
        module: require.resolve('./plugin.fixture.js'),
        export: exportName,
      },
    },
  ]
}

describe('plugin', () => {
  it('fails if testtime contrib is not an object', () => {
    const [result] = importAndLoadTesttimePlugins(stubPlugin('testtime', 'testtimeNotAnObject'))

    expect(isLeft(result)).toBe(true)
    if (isLeft(result)) {
      expect(result.left).toMatchInlineSnapshot(`
        [Error: Ignoring the testtime contribution from the Nexus plugin \`nexus\` because its contribution is not an object.
                This is likely to cause an error in your tests. Please reach out to the author of the plugin to fix the issue.]
      `)
    }
  })
})
