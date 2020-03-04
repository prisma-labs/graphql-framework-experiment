import * as tsm from 'ts-morph'
import { extractContextTypes } from './'

describe('ignores cases that do not apply', () => {
  it('case 1', () => {
    expect(
      extract(`
      foobar.addToContext(req => {
        return { a: 1 }
      })
    `)
    ).toMatchInlineSnapshot(`Array []`)
  })

  it('case 2', () => {
    expect(
      extract(`
      addToContext(req => {
        return { a: 1 }
      })
    `)
    ).toMatchInlineSnapshot(`Array []`)
  })
})

it('extracts return type from all calls', () => {
  expect(
    extract(`
      schema.addToContext(req => {
        return { a: 1 }
      })
    `)
  ).toMatchInlineSnapshot(`
    Array [
      "{ a: number; }",
    ]
  `)
})

//
// Helpers
//

function extract(source: string) {
  const project = new tsm.Project({
    useInMemoryFileSystem: true,
  })
  project.createSourceFile('./src/main.ts', source)
  return extractContextTypes(project.getProgram().compilerObject)
}
