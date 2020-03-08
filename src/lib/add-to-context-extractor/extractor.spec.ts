import * as tsm from 'ts-morph'
import { extractContextTypes } from './extractor'

describe('ignores cases that do not apply', () => {
  it('case 1', () => {
    expect(
      extract(`
        foobar.addToContext(req => { return { a: 1 } })
      `)
    ).toMatchInlineSnapshot(`
      Object {
        "typeImports": Array [],
        "types": Array [],
      }
    `)
  })

  it('case 2', () => {
    expect(
      extract(`
        addToContext(req => { return { a: 1 } })
      `)
    ).toMatchInlineSnapshot(`
      Object {
        "typeImports": Array [],
        "types": Array [],
      }
    `)
  })
})

it('extracts from returned object of primitive values from single call', () => {
  expect(
    extract(`
      schema.addToContext(req => { return { a: 1 } })
    `)
  ).toMatchInlineSnapshot(`
    Object {
      "typeImports": Array [],
      "types": Array [
        "{ a: number; }",
      ],
    }
  `)
})

it('extracts from returned object of primitive values from multiple calls', () => {
  expect(
    extract(`
      schema.addToContext(req => { return { a: 1 } })
      schema.addToContext(req => { return { b: 2 } })
    `)
  ).toMatchInlineSnapshot(`
    Object {
      "typeImports": Array [],
      "types": Array [
        "{ a: number; }",
        "{ b: number; }",
      ],
    }
  `)
})

it('extracts from returned object of referenced primitive value', () => {
  expect(
    extract(`
      let a = 1
      schema.addToContext(req => { return { a } })
    `)
  ).toMatchInlineSnapshot(`
    Object {
      "typeImports": Array [],
      "types": Array [
        "{ a: number; }",
      ],
    }
  `)
})

it('extracts from returned object of referenced object value', () => {
  expect(
    extract(`
      const foo = { bar: { baz: 'test' } }

      schema.addToContext(req => { return { foo } })
    `)
  ).toMatchInlineSnapshot(`
    Object {
      "typeImports": Array [],
      "types": Array [
        "{ foo: { bar: { baz: string; }; }; }",
      ],
    }
  `)
})

it('extracts from returned object of referenced object with inline type', () => {
  expect(
    extract(`
      const foo: { bar: { baz: string } } = {
        bar: {
          baz: 'test',
        },
      }

      schema.addToContext(req => { return { foo } })
    `)
  ).toMatchInlineSnapshot(`
    Object {
      "typeImports": Array [],
      "types": Array [
        "{ foo: { bar: { baz: string; }; }; }",
      ],
    }
  `)
})

it('captures required imports information', () => {
  expect(
    extract(`
      export interface Foo { bar: { baz: string } }
      
      const foo: Foo = {
        bar: {
          baz: 'test',
        },
      }

      schema.addToContext(req => { return { foo } })
    `)
  ).toMatchInlineSnapshot(`
Object {
  "typeImports": Array [
    Object {
      "isExported": true,
      "isNode": false,
      "modulePath": "/src/a",
      "name": "Foo",
    },
  ],
  "types": Array [
    "{ foo: Foo; }",
  ],
}
`)
})

it('detects if a referenced type is not exported', () => {
  expect(
    extract(`
      interface Foo { bar: { baz: string } }
      
      const foo: Foo = {
        bar: {
          baz: 'test',
        },
      }

      schema.addToContext(req => { return { foo } })
    `)
  ).toMatchInlineSnapshot(`
Object {
  "typeImports": Array [
    Object {
      "isExported": false,
      "isNode": false,
      "modulePath": "/src/a",
      "name": "Foo",
    },
  ],
  "types": Array [
    "{ foo: Foo; }",
  ],
}
`)
})

it('extracts optionality from props', () => {
  expect(
    extract(`
      const foo: { bar?: { baz?: string } } = {}

      schema.addToContext(req => { return { foo } })
    `)
  ).toMatchInlineSnapshot(`
Object {
  "typeImports": Array [],
  "types": Array [
    "{ foo: { bar?: { baz?: string; }; }; }",
  ],
}
`)
})

it('extracts from type alias', () => {
  expect(
    extract(`
        export type Foo = { bar: { baz: string } }
        
        const foo: Foo = {
          bar: {
            baz: 'test',
          },
        }
  
        schema.addToContext(req => { return { foo } })
      `)
  ).toMatchInlineSnapshot(`
Object {
  "typeImports": Array [
    Object {
      "isExported": true,
      "isNode": false,
      "modulePath": "/src/a",
      "name": "Foo",
    },
  ],
  "types": Array [
    "{ foo: Foo; }",
  ],
}
`)
})

it('prop type intersection', () => {
  expect(
    extract(`
        export type Bar = { b: 2 }
        export type Foo = { a: 1 }
        schema.addToContext(req => { return { foo: '' as any as Foo & Bar } })
      `)
  ).toMatchInlineSnapshot(`
Object {
  "typeImports": Array [
    Object {
      "isExported": true,
      "isNode": false,
      "modulePath": "/src/a",
      "name": "Foo",
    },
    Object {
      "isExported": true,
      "isNode": false,
      "modulePath": "/src/a",
      "name": "Bar",
    },
  ],
  "types": Array [
    "{ foo: Foo & Bar; }",
  ],
}
`)
})

it('prop type aliased intersection', () => {
  expect(
    extract(`
        type Bar = { b: 2 }
        type Foo = { a: 1 }
        export type Qux = Foo & Bar
        schema.addToContext(req => { return { foo: '' as any as Qux } })
      `)
  ).toMatchInlineSnapshot(`
Object {
  "typeImports": Array [
    Object {
      "isExported": true,
      "isNode": false,
      "modulePath": "/src/a",
      "name": "Qux",
    },
  ],
  "types": Array [
    "{ foo: Qux; }",
  ],
}
`)
})

// todo Feature is supported, but untested.
// todo how do we test this?
it.todo('truncates import paths when detected to be a node stdlib module')
it.todo('truncates import paths when detected to be an external package')
// it('type from node stdlib', () => {
//   expect(
//     extract(`
//       import { IncomingHttpHeaders } from 'http'
//       schema.addToContext(req => {
//         return { foo: '' as any as IncomingHttpHeaders }
//       })
//     `)
//   ).toMatchInlineSnapshot(`
// Object {
//   "typeImports": Array [],
//   "types": Array [
//     "{ foo: any; }",
//   ],
// }
// `)
// })

it.todo('props with union types where one union member is a type reference')
it.todo(
  'props with union intersection types where one intersection member is a type reference'
)

//
// Helpers
//

function extract(...sources: string[]) {
  const letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
  const project = new tsm.Project({
    skipLoadingLibFiles: false,
    useInMemoryFileSystem: true,
  })
  for (const source of sources) {
    const moduleName = letters.shift()!
    project.createSourceFile(`./src/${moduleName}.ts`, source)
  }
  return extractContextTypes(project.getProgram().compilerObject)
}
