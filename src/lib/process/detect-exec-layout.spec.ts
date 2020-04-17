import * as path from 'path'
import * as TestContext from '../test-context'
import { repalceInObject } from '../utils'
import { detectExecLayout } from './detect-exec-layout'

const ctx = TestContext.compose(TestContext.tmpDir, TestContext.fs)

describe('node project detection', () => {
  it('if package.json is present then is a node project', () => {
    ctx.fs.write('package.json', '{}')
    expect(detectExecLayout({ depName: 'nexus', cwd: ctx.tmpDir }).nodeProject).toEqual(true)
  })

  it('if package.json is present in ancestor dir then is a node project', () => {
    ctx.fs.write('package.json', '{}')
    expect(
      detectExecLayout({ depName: 'nexus', cwd: path.join(ctx.tmpDir, 'a', 'b', 'c') }).nodeProject
    ).toEqual(true)
  })

  it('if package.json not present then is not a node project', () => {
    expect(detectExecLayout({ depName: 'nexus', cwd: ctx.tmpDir }).nodeProject).toEqual(false)
  })
})

describe('this process analysis', () => {
  it('finds the real path of the script node executed', () => {
    let data = detectExecLayout({ depName: 'nexus', cwd: ctx.tmpDir }).thisProcessToolBin
    data = repalceInObject(/"\/[^"]+node_modules/, '"/__dynamic__/node_modules', data)
    expect(data).toMatchInlineSnapshot(`
      Object {
        "dir": "/__dynamic__/node_modules/.bin",
        "name": "jest",
        "path": "/__dynamic__/node_modules/.bin/jest",
        "realDir": "/__dynamic__/node_modules/jest/bin",
        "realPath": "/__dynamic__/node_modules/jest/bin/jest.js",
      }
    `)
  })
  it.todo('supports node running script without extension')
})

beforeEach(() => {
  ctx.fs.dir('node_modules')
  ctx.fs.dir('node_modules/.bin')
  ctx.fs.write('node_modules/a/index.js', 'const foo = "bar"')
})

describe('tool project', () => {
  it('if tool is installed then project considered a project of that kind', () => {
    ctx.fs.write('package.json', '{ "dependencies": { "a": "foo" } }')
    ctx.fs.symlink(ctx.fs.path('node_modules/a/index.js'), 'node_modules/.bin/a')
    const data = detectExecLayout({
      depName: 'a',
      cwd: ctx.tmpDir,
      scriptPath: ctx.fs.path('node_modules/.bin/a'),
    })
    expect(data.toolProject).toEqual(true)
  })
})

// it('if script node invokved is the local package bin version then is running local', () => {
//   ctx.fs('')
// })

// Object {

//   "project": Object {
//     "binDir": "/Users/jasonkuhrt/projects/graphql-nexus/nexus/node_modules/.bin",
//     "dir": "/Users/jasonkuhrt/projects/graphql-nexus/nexus",
//     "nodeModulesDir": "/Users/jasonkuhrt/projects/graphql-nexus/nexus/node_modules",
//     "toolBinPath": "/Users/jasonkuhrt/projects/graphql-nexus/nexus/node_modules/.bin/processChild.js",
//     "toolBinRealPath": null,
//   },

//   "runningLocalTool": false,

//   "toolCurrentlyPresentInNodeModules": false,
//   "toolProject": false,
// }
// `)
