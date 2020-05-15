import * as path from 'path'
import * as TestContext from '../test-context'
import { Param1, repalceInObject } from '../utils'
import { detectExecLayout } from './detect-exec-layout'

const ctx = TestContext.compose(TestContext.tmpDir(), TestContext.fs(), (ctx) => {
  return {
    detectExecLayout: (input?: Partial<Param1<typeof detectExecLayout>>) => {
      return repalceInObject(
        ctx.tmpDir,
        '/__dynamic__',
        detectExecLayout({
          depName: 'a',
          cwd: ctx.tmpDir,
          scriptPath: ctx.fs.path('some/other/bin/a'),
          ...input,
        })
      )
    },
  }
})

function nodeProject() {
  ctx.fs.write('package.json', '{}')
}
function installTool() {
  ctx.fs.write('package.json', '{ "dependencies": { "a": "foo" } }')
  ctx.fs.write('node_modules/a/index.js', '')
  ctx.fs.symlink(ctx.fs.path('node_modules/a/index.js'), 'node_modules/.bin/a')
}

beforeEach(() => {
  ctx.fs.dir('some/other/bin/a')
  ctx.fs.dir('node_modules/.bin')
})

describe('node project detection', () => {
  it('if package.json is present then is a node project', () => {
    ctx.fs.write('package.json', '{}')
    expect(ctx.detectExecLayout()).toMatchObject({
      nodeProject: true,
      toolProject: false,
      toolCurrentlyPresentInNodeModules: false,
      runningLocalTool: false,
    })
  })
  it('if package.json is present in ancestor dir then is a node project', () => {
    ctx.fs.write('package.json', '{}')
    expect(ctx.detectExecLayout({ cwd: path.join(ctx.tmpDir, 'a', 'b', 'c') })).toMatchObject({
      nodeProject: true,
      toolProject: false,
      toolCurrentlyPresentInNodeModules: false,
      runningLocalTool: false,
    })
  })
  it('if package.json not present then is not a node project', () => {
    expect(ctx.detectExecLayout().nodeProject).toEqual(false)
    expect(ctx.detectExecLayout()).toMatchObject({
      nodeProject: false,
      toolProject: false,
      toolCurrentlyPresentInNodeModules: false,
      runningLocalTool: false,
    })
  })
})

describe('tool project detection', () => {
  beforeEach(() => {
    ctx.fs.write('package.json', '{}')
  })
  it('if tool not listed as package dep then project not considered of that tool', () => {
    expect(ctx.detectExecLayout()).toMatchObject({
      nodeProject: true,
      toolProject: false,
      toolCurrentlyPresentInNodeModules: false,
      runningLocalTool: false,
    })
  })
  it('if tool listed as package dep then project considered of that tool', () => {
    ctx.fs.write('package.json', '{ "dependencies": { "a": "foo" } }')
    expect(ctx.detectExecLayout()).toMatchObject({
      nodeProject: true,
      toolProject: true,
      toolCurrentlyPresentInNodeModules: false,
      runningLocalTool: false,
    })
  })
})

describe('local available detection', () => {
  beforeEach(installTool)
  it('if tool in deps and installed in node_modules and symlinked in local bin, then considered available', () => {
    expect(ctx.detectExecLayout()).toMatchObject({
      nodeProject: true,
      toolProject: true,
      toolCurrentlyPresentInNodeModules: true,
      runningLocalTool: false,
    })
  })
  it('if just bin missing, discounts being available', () => {
    ctx.fs.remove('node_modules/.bin/a')
    expect(ctx.detectExecLayout()).toMatchObject({
      nodeProject: true,
      toolProject: true,
      toolCurrentlyPresentInNodeModules: false,
      runningLocalTool: false,
    })
  })
  it('if just node_module/dir missing, discounts being available', () => {
    ctx.fs.remove('node_modules/a')
    expect(ctx.detectExecLayout()).toMatchObject({
      nodeProject: true,
      toolProject: true,
      toolCurrentlyPresentInNodeModules: false,
      runningLocalTool: false,
    })
  })
})

describe('running locally detection', () => {
  beforeEach(installTool)
  it('if process script path matches path to tool in project bin then considered running locally', () => {
    expect(ctx.detectExecLayout({ scriptPath: ctx.fs.path('node_modules/.bin/a') })).toMatchObject({
      nodeProject: true,
      toolProject: true,
      toolCurrentlyPresentInNodeModules: true,
      runningLocalTool: true,
    })
  })
  it('if process script path does not match path to tool in project bin then not considered running locally', () => {
    expect(ctx.detectExecLayout({ scriptPath: ctx.fs.path('some/other/bin/a') })).toMatchObject({
      nodeProject: true,
      toolProject: true,
      toolCurrentlyPresentInNodeModules: true,
      runningLocalTool: false,
    })
  })
})

describe('this process analysis', () => {
  beforeEach(() => {
    ctx.fs.write('a/b/c/real.js', '')
    ctx.fs.symlink(ctx.fs.path('a/b/c/real.js'), 'x/y/z/fake')
  })
  it('finds the real path of the script node executed', () => {
    const data = ctx.detectExecLayout({ scriptPath: ctx.fs.path('x/y/z/fake') })
    expect(data.thisProcessToolBin).toMatchInlineSnapshot(`
      Object {
        "dir": "/__dynamic__/x/y/z",
        "name": "fake",
        "path": "/__dynamic__/x/y/z/fake",
        "realDir": "/__dynamic__/a/b/c",
        "realPath": "/__dynamic__/a/b/c/real.js",
      }
    `)
  })
  it('supports node running script without extension', () => {
    const data = ctx.detectExecLayout({ scriptPath: ctx.fs.path('a/b/c/real') })
    expect(data.thisProcessToolBin).toMatchInlineSnapshot(`
      Object {
        "dir": "/__dynamic__/a/b/c",
        "name": "real.js",
        "path": "/__dynamic__/a/b/c/real.js",
        "realDir": "/__dynamic__/a/b/c",
        "realPath": "/__dynamic__/a/b/c/real.js",
      }
    `)
  })
})

describe('project analysis', () => {
  it('null if not a node project', () => {
    const data = ctx.detectExecLayout()
    expect(data.nodeProject).toEqual(false)
    expect(data.project).toEqual(null)
  })
  it('info if a node project', () => {
    nodeProject()
    const data = ctx.detectExecLayout()
    expect(data.nodeProject).toEqual(true)
    expect(data.project).toMatchInlineSnapshot(`
      Object {
        "binDir": "/__dynamic__/node_modules/.bin",
        "dir": "/__dynamic__",
        "nodeModulesDir": "/__dynamic__/node_modules",
        "toolBinPath": "/__dynamic__/node_modules/.bin/a",
        "toolBinRealPath": null,
      }
    `)
  })
  it('finds real path of local bin if present', () => {
    installTool()
    const data = ctx.detectExecLayout()
    expect(data.toolProject).toEqual(true)
    expect(data.project).toMatchInlineSnapshot(`
      Object {
        "binDir": "/__dynamic__/node_modules/.bin",
        "dir": "/__dynamic__",
        "nodeModulesDir": "/__dynamic__/node_modules",
        "toolBinPath": "/__dynamic__/node_modules/.bin/a",
        "toolBinRealPath": "/__dynamic__/node_modules/a/index.js",
      }
    `)
  })
})
