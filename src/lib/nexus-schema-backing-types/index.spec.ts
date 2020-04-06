import * as FS from 'fs-jetpack'
import * as Path from 'path'
import * as TestContext from '../test-context'
import { MemoryFS, writeToFS } from '../testing-utils'
import { extractAndWrite } from './extract-and-write'
import { BackingTypes } from './types'
import { DEFAULT_RELATIVE_BACKING_TYPES_TYPEGEN_PATH } from './write'

const localCtx = TestContext.create((opts: TestContext.TmpDirContribution) => {
  return {
    setup(fs: MemoryFS) {
      writeToFS(opts.tmpDir(), fs)
    },
    async extractAndWrite(filePattern?: string) {
      const cwd = opts.tmpDir()
      const backingTypes = await extractAndWrite(filePattern, {
        extractCwd: cwd,
        writeCwd: cwd,
      })
      const normalizedBackingTypes = Object.entries(backingTypes).reduce<
        BackingTypes
      >((acc, backingType) => {
        const [typeName, filePath] = backingType

        acc[typeName] = Path.relative(cwd, filePath)

        return acc
      }, {})

      const typegenPath = Path.join(
        cwd,
        DEFAULT_RELATIVE_BACKING_TYPES_TYPEGEN_PATH
      )
      const typegen = FS.read(typegenPath)

      return { backingTypes: normalizedBackingTypes, typegen }
    },
  }
})

const ctx = TestContext.compose(TestContext.tmpDir, localCtx)

it('extracts interfaces', async () => {
  ctx.setup({
    'test.ts': 'export interface Test {}',
  })

  const result = await ctx.extractAndWrite()

  expect(result).toMatchInlineSnapshot(`
    Object {
      "backingTypes": Object {
        "Test": "test.ts",
      },
      "typegen": " export type BackingTypes =
      | 'Test'
    declare global {
      export interface NexusBackingTypes {
        types: BackingTypes
      }
    }
    ",
    }
  `)
})

it('extracts type alias', async () => {
  ctx.setup({
    'test.ts': 'export type Test = "something"',
  })

  const result = await ctx.extractAndWrite()

  expect(result).toMatchInlineSnapshot(`
    Object {
      "backingTypes": Object {
        "Test": "test.ts",
      },
      "typegen": " export type BackingTypes =
      | 'Test'
    declare global {
      export interface NexusBackingTypes {
        types: BackingTypes
      }
    }
    ",
    }
  `)
})

it('extracts classes', async () => {
  ctx.setup({
    'test.ts': 'export class Test {}',
  })

  const result = await ctx.extractAndWrite()

  expect(result).toMatchInlineSnapshot(`
Object {
  "backingTypes": Object {
    "Test": "test.ts",
  },
  "typegen": " export type BackingTypes =
  | 'Test'
declare global {
  export interface NexusBackingTypes {
    types: BackingTypes
  }
}
",
}
`)
})

it('extracts enums', async () => {
  ctx.setup({
    'test.ts': 'export enum Test {}',
  })

  const result = await ctx.extractAndWrite()

  expect(result).toMatchInlineSnapshot(`
Object {
  "backingTypes": Object {
    "Test": "test.ts",
  },
  "typegen": " export type BackingTypes =
  | 'Test'
declare global {
  export interface NexusBackingTypes {
    types: BackingTypes
  }
}
",
}
`)
})

it('does not extract not exported types', async () => {
  ctx.setup({
    'test.ts': `
    enum Test1 {}
    class Test2 {}
    interface Test3 {}
    type Test4 = ''
    `,
  })

  const result = await ctx.extractAndWrite()

  expect(result).toMatchInlineSnapshot(`
Object {
  "backingTypes": Object {},
  "typegen": "export type BackingTypes = 'No backing types found. Make sure you have some types exported'
declare global {
  export interface NexusBackingTypes {
    types: BackingTypes
  }
}
",
}
`)
})

it('does not extract anything when there is not type to extract', async () => {
  ctx.setup({
    'test.ts': '',
  })

  const result = await ctx.extractAndWrite()

  expect(result).toMatchInlineSnapshot(`
Object {
  "backingTypes": Object {},
  "typegen": "export type BackingTypes = 'No backing types found. Make sure you have some types exported'
declare global {
  export interface NexusBackingTypes {
    types: BackingTypes
  }
}
",
}
`)
})
