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
        Object {
          "kind": "literal",
          "value": "{ a: number; }",
        },
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
        Object {
          "kind": "literal",
          "value": "{ a: number; }",
        },
        Object {
          "kind": "literal",
          "value": "{ b: number; }",
        },
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
        Object {
          "kind": "literal",
          "value": "{ a: number; }",
        },
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
        Object {
          "kind": "literal",
          "value": "{ foo: { bar: { baz: string; }; }; }",
        },
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
        Object {
          "kind": "literal",
          "value": "{ foo: { bar: { baz: string; }; }; }",
        },
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
        Object {
          "kind": "literal",
          "value": "{ foo: Foo; }",
        },
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
        Object {
          "kind": "literal",
          "value": "{ foo: Foo; }",
        },
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
        Object {
          "kind": "literal",
          "value": "{ foo: { bar?: { baz?: string; }; }; }",
        },
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
        Object {
          "kind": "literal",
          "value": "{ foo: Foo; }",
        },
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
        Object {
          "kind": "literal",
          "value": "{ foo: Foo & Bar; }",
        },
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
        Object {
          "kind": "literal",
          "value": "{ foo: Qux; }",
        },
      ],
    }
  `)
})

it('prop type union', () => {
  expect(
    extract(`
        export type Bar = { b: 2 }
        export type Foo = { a: 1 }
        schema.addToContext(req => { return { foo: '' as any as Foo | Bar } })
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
        Object {
          "kind": "literal",
          "value": "{ foo: Foo | Bar; }",
        },
      ],
    }
  `)
})

it('prop type aliased union', () => {
  expect(
    extract(`
        type Bar = { b: 2 }
        type Foo = { a: 1 }
        export type Qux = Foo | Bar
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
        Object {
          "kind": "literal",
          "value": "{ foo: Qux; }",
        },
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
it.todo('props with union intersection types where one intersection member is a type reference')

describe('extracted type refs', () => {
  it('an alias', () => {
    expect(
      extract(`
        export type A {}
        const a: A
        schema.addToContext(req => { return null as A })
      `)
    ).toMatchInlineSnapshot(`
    Object {
      "typeImports": Array [
        Object {
          "isExported": true,
          "isNode": false,
          "modulePath": "/src/a",
          "name": "A",
        },
      ],
      "types": Array [
        Object {
          "kind": "ref",
          "name": "A",
        },
      ],
    }
  `)
  })
  it('an interface', () => {
    expect(
      extract(`
        export interface A {}
        const a: A
        schema.addToContext(req => { return null as A })
      `)
    ).toMatchInlineSnapshot(`
    Object {
      "typeImports": Array [
        Object {
          "isExported": true,
          "isNode": false,
          "modulePath": "/src/a",
          "name": "A",
        },
      ],
      "types": Array [
        Object {
          "kind": "ref",
          "name": "A",
        },
      ],
    }
  `)
  })
})

it('dedupes imports', () => {
  expect(
    extract(`
        export interface Qux { b: 2 }
        schema.addToContext(req => { return { foo: {} as Qux, bar: {} as Qux } })
        schema.addToContext(req => { return { mar: {} as Qux } })
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
        Object {
          "kind": "literal",
          "value": "{ foo: Qux; bar: Qux; }",
        },
        Object {
          "kind": "literal",
          "value": "{ mar: Qux; }",
        },
      ],
    }
  `)
})

it('does not import array types', () => {
  expect(
    extract(`
        schema.addToContext(req => { return { foo: [] as string[] } })
      `)
  ).toMatchInlineSnapshot(`
    Object {
      "typeImports": Array [],
      "types": Array [
        Object {
          "kind": "literal",
          "value": "{ foo: string[]; }",
        },
      ],
    }
  `)
})

// TODO: Figure out why type-checker doesn't find the Promise type
it.todo(
  'support Promise.resolve'
) /*, () => {
  expect(
    extract(`
        schema.addToContext(req => {
          return {
            foo: Promise.resolve(1)
          }
        })
      `)
  ).toMatchInlineSnapshot(`
    Object {
      "typeImports": Array [],
      "types": Array [
        "{ foo: any; }",
      ],
    }
  `)
})*/

it('support async/await', () => {
  expect(
    extract(`
        schema.addToContext(async req => { return { foo: [] as string[] } })
      `)
  ).toMatchInlineSnapshot(`
    Object {
      "typeImports": Array [],
      "types": Array [
        Object {
          "kind": "literal",
          "value": "{ foo: string[]; }",
        },
      ],
    }
  `)
})

// This test is only relevant so long as we're using the TS type to string
// function
// todo cannot find a case that leads to TS truncating...
// Spreading IncomingHttpHeaders will trigger it, but no access to node stdlib
// with in memory FS...
// it('does not', () => {
//   expect(
//     extract(`
//         schema.addToContext(req => { return {} as any as { a:0; b:0; c:0; d:0; e:0; f:0; g:0; h:0; i:0; k:0; l:0; m:0; n:0; l:0; o:0; p:0; q:0; r:0; s:0; t:0; u:0; v:0; x:0; y:0; z:0; a2:0; b2:0; c2:0; d2:0; e2:0; f2:0; g2:0; h2:0; i2:0; k2:0; l2:0; m2:0; n2:0; l2:0; o2:0; p2:0; q2:0; r2:0; s2:0; t2:0; u2:0; v2:0; x2:0; y2:0; z2:0; } })
//       `)
//   ).toMatchInlineSnapshot(`
// Object {
//   "typeImports": Array [],
//   "types": Array [
//     "{ foo: any; any: any; as: any; Foo: any; }",
//   ],
// }
// `)
// })

//
// Helpers
//

function extract(...sources: string[]) {
  const letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
  const project = new tsm.Project({
    useInMemoryFileSystem: true,
  })
  for (const source of sources) {
    const moduleName = letters.shift()!
    project.createSourceFile(`./src/${moduleName}.ts`, source)
  }
  return extractContextTypes(project.getProgram().compilerObject)
}
