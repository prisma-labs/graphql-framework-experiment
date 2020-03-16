import * as tsm from 'ts-morph'
import { extractWithTS, extractFromTSProgram } from './extract'

it('extracts interfaces', () => {
  expect(
    extract(`
    export interface Interface1 {}
    export interface Interface2 {}
  `)
  ).toMatchInlineSnapshot(`
    Object {
      "Interface1": "/src/a.ts",
      "Interface2": "/src/a.ts",
    }
  `)
})

it('extracts type aliases', () => {
  expect(
    extract(`
    export type TypeAlias1 = {}
    export type TypeAlias2 = {}
  `)
  ).toMatchInlineSnapshot(`
    Object {
      "TypeAlias1": "/src/a.ts",
      "TypeAlias2": "/src/a.ts",
    }
  `)
})

it('extracts type classes', () => {
  expect(
    extract(`
    export class Class1 {}
    export class Class2 {}
  `)
  ).toMatchInlineSnapshot(`
Object {
  "Class1": "/src/a.ts",
  "Class2": "/src/a.ts",
}
`)
})

function extract(...sources: string[]) {
  const letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
  const project = new tsm.Project({
    useInMemoryFileSystem: true,
  })
  for (const source of sources) {
    const moduleName = letters.shift()!
    project.createSourceFile(`./src/${moduleName}.ts`, source)
  }
  return extractFromTSProgram(project.getProgram().compilerObject)
}
