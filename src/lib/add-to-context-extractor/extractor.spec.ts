import { isLeft } from 'fp-ts/lib/Either'
import * as tsm from 'ts-morph'
import { normalizePathsInData } from '../../lib/utils'
import { extractContextTypes } from './extractor'
import { DEFAULT_CONTEXT_TYPES } from './typegen'

describe('syntax cases', () => {
  it('will extract from import name of nexus default export', () => {
    expect(
      extractOrThrow(
        `
          import n from 'nexus'
          n.schema.addToContext(req => ({ a: 1 }))
        `,
        { noImport: true }
      ).types.length
    ).toEqual(1)
  })
  it('will extract from named import "schema" of nexus', () => {
    expect(
      extractOrThrow(
        `
          import { schema } from 'nexus'
          schema.addToContext(req => ({ a: 1 }))
        `,
        { noImport: true }
      ).types.length
    ).toEqual(1)
  })
  it('will extract from named aliased import "schema" of nexus', () => {
    expect(
      extractOrThrow(
        `
          import { schema as s } from 'nexus'
          s.addToContext(req => ({ a: 1 }))
        `,
        { noImport: true }
      ).types.length
    ).toEqual(1)
  })
  it('will extract from mix of all cases in single module', () => {
    expect(
      extractOrThrow(
        `
          import app from 'nexus'
          import { schema } from 'nexus'
          import { schema as s } from 'nexus'
          app.schema.addToContext(req => ({ a: 1 }))
          schema.addToContext(req => ({ a: 1 }))
          s.addToContext(req => ({ a: 1 }))
        `,
        { noImport: true }
      ).types.length
    ).toEqual(3)
  })
  describe('does not extract when not relevant AST pattern', () => {
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

it('all types extracted from the default context data are importable', () => {
  const allTypesExported = DEFAULT_CONTEXT_TYPES.typeImports.every((i) => {
    const project = new tsm.Project({
      addFilesFromTsConfig: false,
      skipFileDependencyResolution: true,
    })

    const sourceFile = project.addSourceFileAtPath(i.modulePath + '.ts')

    return sourceFile.getExportedDeclarations().has(i.name)
  })

  expect(allTypesExported).toEqual(true)
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
          "value": "{ foo: { bar?: { baz?: string | undefined; } | undefined; }; }",
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

describe('top-level union types', () => {
  it('reduces literal union types', () => {
    expect(
      extract(`
          schema.addToContext(req => {
            return {} as { jwt: string } | { jwt: null }
          })
        `)
    ).toMatchInlineSnapshot(`
      Object {
        "typeImports": Array [],
        "types": Array [
          Object {
            "kind": "literal",
            "value": "{ jwt: string | null; }",
          },
        ],
      }
    `)
  })

  it('reduces interface union types', () => {
    expect(
      extract(`
          interface A {
            jwt: string
          }
          interface B {
            jwt: null
          }
          schema.addToContext(req => {
            return {} as A | B
          })
        `)
    ).toMatchInlineSnapshot(`
      Object {
        "typeImports": Array [],
        "types": Array [
          Object {
            "kind": "literal",
            "value": "{ jwt: string | null; }",
          },
        ],
      }
    `)
  })
  it('reduces type alias union types', () => {
    expect(
      extract(`
          type A = {
            jwt: string
          }
          type B = {
            jwt: null
          }
          schema.addToContext(req => {
            return {} as A | B
          })
        `)
    ).toMatchInlineSnapshot(`
      Object {
        "typeImports": Array [],
        "types": Array [
          Object {
            "kind": "literal",
            "value": "{ jwt: string | null; }",
          },
        ],
      }
    `)
  })

  it('reduces union types composed of different properties', () => {
    expect(
      extract(`
          schema.addToContext(req => {
            if (true) {
              return { a: 1 }
            } else {
              return { b: 2 }
            }
          })
        `)
    ).toMatchInlineSnapshot(`
      Object {
        "typeImports": Array [],
        "types": Array [
          Object {
            "kind": "literal",
            "value": "{ a?: number; b?: number; }",
          },
        ],
      }
    `)
  })

  it('sets properties to be optional if they are not part of every union members', () => {
    expect(
      extract(`
          schema.addToContext(req => {
            return {} as { a: 1 } | { a: 2 } | { b: 3 }
          })
        `)
    ).toMatchInlineSnapshot(`
      Object {
        "typeImports": Array [],
        "types": Array [
          Object {
            "kind": "literal",
            "value": "{ a?: 1 | 2; b?: 3; }",
          },
        ],
      }
    `)
  })

  it('preserves imports when reducing type aliases', () => {
    expect(
      extract(`
          export type A = { jwt: string }
          schema.addToContext(req => {
            return {} as { jwt: A } | { jwt: null }
          })
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
            "kind": "literal",
            "value": "{ jwt: A | null; }",
          },
        ],
      }
    `)
  })

  it('does not reduces top-level unions that are not entirely composed of interfaces, object literals, or type aliases that refers to object literals', () => {
    expect(
      extract(`
          schema.addToContext(req => {
            return {} as { jwt: string } | boolean
          })
        `)
    ).toMatchInlineSnapshot(
      `[Error: Error in schema.addToContext: Top-level union types that are not composed entirely of interfaces, object literals, or type aliases that refers to object literals are not supported.]`
    )
  })
})

describe('generics', () => {
  it('types that are referenced in the generic of a type alias get extracted as type imports', () => {
    expect(
      extract(`
          interface Foo1 {}
          interface Foo2 {}
          interface Foo3 {}
          interface Foo4 {}
          type Bar<T> = {}
          schema.addToContext(() => {
            return { } as { a: Bar<Foo1>; b: number | Bar<Foo2>; c: Foo3 & Bar<Foo4> }
          })
        `)
    ).toMatchInlineSnapshot(`
      Object {
        "typeImports": Array [
          Object {
            "isExported": false,
            "isNode": false,
            "modulePath": "/src/a",
            "name": "Bar",
          },
          Object {
            "isExported": false,
            "isNode": false,
            "modulePath": "/src/a",
            "name": "Foo1",
          },
          Object {
            "isExported": false,
            "isNode": false,
            "modulePath": "/src/a",
            "name": "Foo2",
          },
          Object {
            "isExported": false,
            "isNode": false,
            "modulePath": "/src/a",
            "name": "Foo3",
          },
        ],
        "types": Array [
          Object {
            "kind": "literal",
            "value": "{ a: Bar<Foo1>; b: number | Bar<Foo2>; c: Foo3; }",
          },
        ],
      }
    `)
  })
  it('types that are referenced in the generic of an interface get extracted as type imports', () => {
    expect(
      extract(`
          interface Foo1 {}
          interface Foo2 {}
          interface Foo3 {}
          interface Foo4 {}
          interface Bar<T> {}
          schema.addToContext(() => {
            return { } as { a: Bar<Foo1>; b: number | Bar<Foo2>; c: Foo3 & Bar<Foo4> }
          })
        `)
    ).toMatchInlineSnapshot(`
      Object {
        "typeImports": Array [
          Object {
            "isExported": false,
            "isNode": false,
            "modulePath": "/src/a",
            "name": "Bar",
          },
          Object {
            "isExported": false,
            "isNode": false,
            "modulePath": "/src/a",
            "name": "Foo1",
          },
          Object {
            "isExported": false,
            "isNode": false,
            "modulePath": "/src/a",
            "name": "Foo2",
          },
          Object {
            "isExported": false,
            "isNode": false,
            "modulePath": "/src/a",
            "name": "Foo3",
          },
          Object {
            "isExported": false,
            "isNode": false,
            "modulePath": "/src/a",
            "name": "Foo4",
          },
        ],
        "types": Array [
          Object {
            "kind": "literal",
            "value": "{ a: Bar<Foo1>; b: number | Bar<Foo2>; c: Foo3 & Bar<Foo4>; }",
          },
        ],
      }
    `)
  })
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

type Opts = { noImport: boolean }
function extract(source: string, opts: Opts = { noImport: false }) {
  const letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
  const project = new tsm.Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      strict: true,
    },
  })

  if (!opts.noImport) {
    source = `import { schema } from 'nexus'\n\n${source}`
  }

  const moduleName = letters.shift()!
  project.createSourceFile(`./src/${moduleName}.ts`, source)

  const result = extractContextTypes(project)

  if (isLeft(result)) {
    return result.left
  }

  return normalizePathsInData(result.right)
}

function extractOrThrow(source: string, opts: Opts = { noImport: false }) {
  const result = extract(source, opts)
  if (result instanceof Error) throw result
  else return result
}
