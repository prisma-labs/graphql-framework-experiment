import * as Path from 'path'
import * as TC from '../test-context'
import { repalceInObject } from '../utils'
import { getPluginManifest } from './manifest'
import { Plugin } from './types'

const ctx = TC.create(TC.tmpDir(), TC.fs())

let originalProcessExit: any

beforeEach(() => {
  originalProcessExit = process.exit
  process.exit = (() => console.log('exit')) as any
})

describe('manifest', () => {
  it('processes the manifest input with defaults', () => {
    ctx.fs.write('package.json', `{ "name": "foo", "main": "./dist/index.js" }`)
    const plugin: Plugin = {
      packageJsonPath: Path.join(ctx.tmpDir, 'package.json'),
    }
    expect(repalceInObject(ctx.tmpDir, '<project root>', getPluginManifest(plugin))).toMatchInlineSnapshot(`
      Object {
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
      }
    `)
  })
})
