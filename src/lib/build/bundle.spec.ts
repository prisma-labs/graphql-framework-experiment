import { NodeFileTraceReasons } from '@zeit/node-file-trace'
import * as Path from 'path'
import slash from 'slash'
import { traceFiles } from './bundle'

const base = Path.dirname(require.resolve('../../../package.json'))
const entrypoint = Path.join(base, 'dist', 'index.js')

it('should not bundle typescript', async () => {
  const { reasons } = await traceFiles({
    base,
    entrypoint,
    plugins: [],
  })
  const isTypescriptBundled = isModuleBundled('node_modules/typescript/lib/typescript.js', reasons)

  expect(isTypescriptBundled).toMatchInlineSnapshot(`false`)
})

it('should not bundle any of the cli', async () => {
  const { files } = await traceFiles({
    base,
    entrypoint,
    plugins: [],
  })

  const cliFiles = Array.from(files.keys()).filter((f) => f.includes('dist/cli/'))

  expect(cliFiles).toMatchInlineSnapshot(`Array []`)
})

it('should walk files and deps', async () => {
  const { files } = await traceFiles({
    base: __dirname,
    entrypoint: require.resolve('./bundler-fixture'),
    plugins: [],
  })

  const walkedPaths = Array.from(files.keys()).map((path) => slash(path))

  expect(walkedPaths).toMatchInlineSnapshot(`
    Array [
      "bundler-fixture/dist/index.js",
      "bundler-fixture/dist/module-b.js",
      "bundler-fixture/package.json",
      "bundler-fixture/node_modules/lib-a/package.json",
      "bundler-fixture/node_modules/lib-a/dist/index.js",
      "bundler-fixture/node_modules/lib-a/node_modules/lib-b/package.json",
      "bundler-fixture/node_modules/lib-a/node_modules/lib-b/dist/index.js",
    ]
  `)
})

function walkParents(parents: string[], reasons: NodeFileTraceReasons, path: Array<string | string[]>): void {
  if (parents.length === 0) {
    return
  }

  if (parents.length === 1) {
    path.push(parents[0])
  } else {
    path.push(parents)
  }

  parents.forEach((p) => {
    const module = reasons[p]
    walkParents(module.parents, reasons, path)
  })
}

export function isModuleBundled(
  moduleId: string,
  reasons: NodeFileTraceReasons
): false | { reason: Array<string | string[]> } {
  const module = reasons[moduleId]

  if (!module) {
    return false
  }

  let path: (string | string[])[] = [moduleId]

  walkParents(module.parents, reasons, path)

  return { reason: path.reverse() }
}

describe('deployment=heroku', () => {
  it.todo('checks that the start script points to the build output (bundle true)')
  it.todo('checks that the start script points to the build output (bundle false)')
  it.todo('checks that the package engines field is correctly set')
})
