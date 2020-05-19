import { isLeft } from 'fp-ts/lib/Either'
import * as Path from 'path'
import * as TC from '../test-context'
import { repalceInObject } from '../utils'
import { importAndLoadTesttimePlugins } from './load'
import { getPluginManifest } from './manifest'
import { Dimension, Plugin, PluginWithoutSettings } from './types'

const ctx = TC.create(TC.tmpDir(), TC.fs())

describe('manifest', () => {
  let plugin: Plugin
  const run = () => repalceInObject(ctx.tmpDir, '<project root>', getPluginManifest(plugin))

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
          },
          "message": "Failed to read the the package.json file.

      Error: Cannot find module '<project root>/package.json' from 'src/lib/plugin/manifest.ts'",
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
            "plugin": Object {
              "packageJsonPath": "<project root>/package.json",
            },
          },
          "message": "\`name\` property is missing in package.json",
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
          },
          "message": "\`main\` property is missing in package.json",
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

// TODO: figure out why it's process.exiting
describe('plugin', () => {
  it('fails if testtime contrib is not an object', () => {
    const [result] = importAndLoadTesttimePlugins(stubPlugin('testtime', 'wrongTesttimePlugin'))

    expect(isLeft(result)).toStrictEqual(true)
  })
})
