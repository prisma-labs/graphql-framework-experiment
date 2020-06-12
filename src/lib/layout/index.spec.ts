process.env.FORCE_COLOR = '0'
let mockedStdoutBuffer: string = ''
const mockStdout = jest.spyOn(process.stdout, 'write').mockImplementation((data) => {
  mockedStdoutBuffer += data
  return true
})

afterEach(() => {
  mockedStdoutBuffer = ''
})

const mockExit = jest.spyOn(process, 'exit').mockImplementation(((n: any) => {
  mockedStdoutBuffer += `\n\n--- process.exit(${n}) ---\n\n`
}) as any)

import { log } from '@nexus/logger'
import stripAnsi from 'strip-ansi'
import { TsConfigJson } from 'type-fest'
import * as Layout from '.'
import { FSSpec, writeFSSpec } from '../../lib/testing-utils'
import { rightOrThrow } from '../glocal/utils'
import * as TC from '../test-context'
import { repalceInObject, replaceEvery } from '../utils'
import { NEXUS_TS_LSP_IMPORT_ID } from './tsconfig'

/**
 * Disable logger timeDiff and color to allow snapshot matching
 */
log.settings({
  pretty: {
    enabled: true,
    timeDiff: false,
    color: false,
  },
})

// Force stdout width to not wrap the logs and mess with the snapshots
process.stdout.columns = 300

/**
 * Helpers
 */

function tsconfigContent(input: TsConfigJson): string {
  return JSON.stringify(input)
}

const defaultTsConfigContent = {
  compilerOptions: {
    rootDir: '.',
    plugins: [{ name: NEXUS_TS_LSP_IMPORT_ID }],
  },
  include: ['.'],
}

const fsTsConfig = {
  'tsconfig.json': tsconfigContent(defaultTsConfigContent),
}

const ctx = TC.create(
  TC.tmpDir(),
  TC.fs(),
  TC.createContributor((ctx) => {
    return {
      setup(spec: FSSpec = {}) {
        writeFSSpec(ctx.tmpDir, spec)
      },
      stripTmpDir(x: object | string) {
        return typeof x === 'string'
          ? replaceEvery(x, ctx.tmpDir, '__DYNAMIC__')
          : repalceInObject(ctx.tmpDir, '__DYNAMIC__', x)
      },
      async scanThrow(opts?: { entrypointPath?: string; buildOutput?: string }) {
        const data = rightOrThrow(
          await Layout.create({
            cwd: ctx.tmpDir,
            entrypointPath: opts?.entrypointPath,
            buildOutputDir: opts?.buildOutput,
            asBundle: false,
          })
        )
        mockedStdoutBuffer = mockedStdoutBuffer.split(ctx.tmpDir).join('__DYNAMIC__')
        return repalceInObject(ctx.tmpDir, '__DYNAMIC__', data.data)
      },
      async scan(opts?: { entrypointPath?: string; buildOutput?: string }) {
        return Layout.create({
          cwd: ctx.tmpDir,
          entrypointPath: opts?.entrypointPath,
          buildOutputDir: opts?.buildOutput,
          asBundle: false,
        }).then((v) => repalceInObject(ctx.tmpDir, '__DYNAMIC__', v))
      },
    }
  })
)

/**
 * Tests
 */

it('fails if empty file tree', async () => {
  ctx.setup()

  try {
    await ctx.scanThrow()
  } catch (err) {
    expect(err.message).toContain("Path you want to find stuff in doesn't exist")
  }
})

describe('tsconfig', () => {
  beforeEach(() => {
    ctx.setup({ 'app.ts': '' })
  })

  it('will scaffold tsconfig if not present', async () => {
    await ctx.scanThrow()
    expect(mockedStdoutBuffer).toMatchInlineSnapshot(`
      "▲ nexus:tsconfig We could not find a \\"tsconfig.json\\" file
      ▲ nexus:tsconfig We scaffolded one for you at __DYNAMIC__/tsconfig.json
      "
    `)
    expect(ctx.fs.read('tsconfig.json', 'json')).toMatchInlineSnapshot(`
      Object {
        "compilerOptions": Object {
          "lib": Array [
            "esnext",
          ],
          "module": "commonjs",
          "plugins": Array [
            Object {
              "name": "nexus/typescript-language-service",
            },
          ],
          "rootDir": ".",
          "strict": true,
          "target": "es2016",
        },
        "include": Array [
          ".",
        ],
      }
    `)
  })

  it('will warn if reserved settings are in use', async () => {
    ctx.setup({
      'tsconfig.json': tsconfigContent({
        compilerOptions: {
          rootDir: '.',
          incremental: true,
          tsBuildInfoFile: 'foo',
          plugins: defaultTsConfigContent.compilerOptions.plugins,
        },
        include: ['.'],
      }),
    })
    await ctx.scanThrow()
    expect(mockedStdoutBuffer).toMatchInlineSnapshot(`
      "▲ nexus:tsconfig You have set compilerOptions.tsBuildInfoFile in your tsconfig.json but it will be ignored by Nexus. Nexus manages this value internally.
      ▲ nexus:tsconfig You have set compilerOptions.incremental in your tsconfig.json but it will be ignored by Nexus. Nexus manages this value internally.
      "
    `)
  })

  it('will warn if required settings are not set and set them in memory', async () => {
    ctx.setup({
      'tsconfig.json': '',
    })
    const layout = await ctx.scanThrow()
    expect(mockedStdoutBuffer).toMatchInlineSnapshot(`
      "▲ nexus:tsconfig You have not setup the Nexus TypeScript Language Service Plugin. Add this to your tsconfig compiler options:

          \\"plugins\\": [{ \\"name\\": \\"nexus/typescript-language-service\\" }]

      ▲ nexus:tsconfig Please set your tsconfig.json compilerOptions.rootDir to \\".\\"
      ▲ nexus:tsconfig Please set your tsconfig.json include to have \\".\\"
      "
    `)
    expect(layout.tsConfig.content.raw.compilerOptions.rootDir).toEqual('.')
    expect(layout.tsConfig.content.raw.include).toEqual(['.'])
  })

  it("will contextually warn if have TS LSP's present but not nexus one", async () => {
    ctx.setup({
      'tsconfig.json': tsconfigContent({
        ...defaultTsConfigContent,
        compilerOptions: { ...defaultTsConfigContent.compilerOptions, plugins: [{ name: 'foobar' }] },
      }),
    })

    await ctx.scanThrow()
    expect(mockedStdoutBuffer).toMatchInlineSnapshot(`
      "▲ nexus:tsconfig You have not added the Nexus TypeScript Language Service Plugin to your configured TypeScript plugins. Add this to your tsconfig compiler options:

          \\"plugins\\": [{\\"name\\":\\"foobar\\"},{\\"name\\":\\"nexus/typescript-language-service\\"}]

      "
    `)
  })

  it('will fatal message and exit if error reading file', async () => {
    ctx.setup({
      'tsconfig.json': 'bad json',
    })
    await ctx.scanThrow()
    expect(stripAnsi(mockedStdoutBuffer)).toMatchInlineSnapshot(`
      "✕ nexus:tsconfig Unable to read your tsconifg.json

      ../../../../..__DYNAMIC__/tsconfig.json:1:1 - error TS1005: '{' expected.

      1 bad json
        ~~~



      --- process.exit(1) ---

      ▲ nexus:tsconfig You have not setup the Nexus TypeScript Language Service Plugin. Add this to your tsconfig compiler options:

          \\"plugins\\": [{ \\"name\\": \\"nexus/typescript-language-service\\" }]

      ▲ nexus:tsconfig Please set your tsconfig.json compilerOptions.rootDir to \\".\\"
      ▲ nexus:tsconfig Please set your tsconfig.json include to have \\".\\"
      "
    `)
  })

  it('will fatal message and exit if invalid tsconfig schema', async () => {
    ctx.setup({
      'tsconfig.json': '{ "exclude": "bad" }',
    })
    await ctx.scanThrow()
    expect(stripAnsi(mockedStdoutBuffer)).toMatchInlineSnapshot(`
      "▲ nexus:tsconfig You have not setup the Nexus TypeScript Language Service Plugin. Add this to your tsconfig compiler options:

          \\"plugins\\": [{ \\"name\\": \\"nexus/typescript-language-service\\" }]

      ▲ nexus:tsconfig Please set your tsconfig.json compilerOptions.rootDir to \\".\\"
      ▲ nexus:tsconfig Please set your tsconfig.json include to have \\".\\"
      ✕ nexus:tsconfig Your tsconfig.json is invalid

      error TS5024: Compiler option 'exclude' requires a value of type Array.



      --- process.exit(1) ---

      "
    `)
  })
})

it('fails if no entrypoint and no graphql modules', async () => {
  ctx.setup({
    ...fsTsConfig,
    src: {
      'User.ts': '',
      'Post.ts': '',
    },
  })

  await ctx.scanThrow()

  expect(mockedStdoutBuffer).toMatchInlineSnapshot(`
    "■ nexus:layout We could not find any modules that imports 'nexus' or app.ts entrypoint
    ■ nexus:layout Please do one of the following:

      1. Create a file, import { schema } from 'nexus' and write your GraphQL type definitions in it.
      2. Create an app.ts file.


    --- process.exit(1) ---

    "
  `)
  expect(mockExit).toHaveBeenCalledWith(1)
})

it('finds nested nexus modules', async () => {
  ctx.setup({
    ...fsTsConfig,
    src: {
      'app.ts': '',
      graphql: {
        '1.ts': `import { schema } from 'nexus'`,
        '2.ts': `import { schema } from 'nexus'`,
        graphql: {
          '3.ts': `import { schema } from 'nexus'`,
          '4.ts': `import { schema } from 'nexus'`,
          graphql: {
            '5.ts': `import { schema } from 'nexus'`,
            '6.ts': `import { schema } from 'nexus'`,
          },
        },
      },
    },
  })

  const result = await ctx.scanThrow()

  expect(result.nexusModules).toMatchInlineSnapshot(`
    Array [
      "__DYNAMIC__/src/graphql/1.ts",
      "__DYNAMIC__/src/graphql/2.ts",
      "__DYNAMIC__/src/graphql/graphql/3.ts",
      "__DYNAMIC__/src/graphql/graphql/4.ts",
      "__DYNAMIC__/src/graphql/graphql/graphql/5.ts",
      "__DYNAMIC__/src/graphql/graphql/graphql/6.ts",
    ]
  `)
})

it('detects yarn as package manager', async () => {
  ctx.setup({ ...fsTsConfig, 'app.ts': '', 'yarn.lock': '' })
  const result = await ctx.scanThrow()
  expect(result.packageManagerType).toMatchInlineSnapshot(`"yarn"`)
})

it('finds app.ts entrypoint', async () => {
  ctx.setup({ ...fsTsConfig, 'app.ts': '' })
  const result = await ctx.scanThrow()
  expect(result.app).toMatchInlineSnapshot(`
    Object {
      "exists": true,
      "path": "__DYNAMIC__/app.ts",
    }
  `)
})

it('set app.exists = false if no entrypoint', async () => {
  await ctx.setup({ ...fsTsConfig, 'graphql.ts': '' })
  const result = await ctx.scanThrow()
  expect(result.app).toMatchInlineSnapshot(`
    Object {
      "exists": false,
      "path": null,
    }
  `)
})

it('uses custom relative entrypoint when defined', async () => {
  await ctx.setup({ ...fsTsConfig, 'index.ts': `console.log('entrypoint')` })
  const result = await ctx.scanThrow({ entrypointPath: './index.ts' })
  expect(result.app).toMatchInlineSnapshot(`
    Object {
      "exists": true,
      "path": "__DYNAMIC__/index.ts",
    }
  `)
})

it('uses custom absolute entrypoint when defined', async () => {
  await ctx.setup({ ...fsTsConfig, 'index.ts': `console.log('entrypoint')` })
  const result = await ctx.scanThrow({ entrypointPath: ctx.fs.path('index.ts') })
  expect(result.app).toMatchInlineSnapshot(`
    Object {
      "exists": true,
      "path": "__DYNAMIC__/index.ts",
    }
  `)
})

it('fails if custom entrypoint does not exist', async () => {
  await ctx.setup({ ...fsTsConfig, 'index.ts': `console.log('entrypoint')` })
  const result = await ctx.scan({ entrypointPath: './wrong-path.ts' })
  expect(JSON.stringify(result)).toMatchInlineSnapshot(
    `"{\\"_tag\\":\\"Left\\",\\"left\\":{\\"message\\":\\"Entrypoint does not exist\\",\\"context\\":{\\"path\\":\\"__DYNAMIC__/wrong-path.ts\\"}}}"`
  )
})

it('fails if custom entrypoint is not a .ts file', async () => {
  await ctx.setup({ ...fsTsConfig, 'index.ts': ``, 'index.js': `console.log('entrypoint')` })
  const result = await ctx.scan({ entrypointPath: './index.js' })
  expect(JSON.stringify(result)).toMatchInlineSnapshot(
    `"{\\"_tag\\":\\"Left\\",\\"left\\":{\\"message\\":\\"Entrypoint must be a .ts file\\",\\"context\\":{\\"path\\":\\"__DYNAMIC__/index.js\\"}}}"`
  )
})

it('does not take custom entrypoint as nexus module if contains a nexus import', async () => {
  await ctx.setup({
    ...fsTsConfig,
    'app.ts': `import { schema } from 'nexus'`,
    'graphql.ts': `import { schema } from 'nexus'`,
  })
  const result = await ctx.scanThrow({ entrypointPath: './app.ts' })
  expect({
    app: result.app,
    nexusModules: result.nexusModules,
  }).toMatchInlineSnapshot(`
    Object {
      "app": Object {
        "exists": true,
        "path": "__DYNAMIC__/app.ts",
      },
      "nexusModules": Array [
        "__DYNAMIC__/graphql.ts",
      ],
    }
  `)
})

describe('build output', () => {
  it(`defaults to .nexus/build`, async () => {
    await ctx.setup({ ...fsTsConfig, 'graphql.ts': '' })
    const result = await ctx.scanThrow()

    expect({
      tsOutputDir: result.build.tsOutputDir,
      startModuleInPath: result.build.startModuleInPath,
      startModuleOutPath: result.build.startModuleOutPath,
    }).toMatchInlineSnapshot(`
      Object {
        "startModuleInPath": "__DYNAMIC__/index.ts",
        "startModuleOutPath": "__DYNAMIC__/.nexus/build/index.js",
        "tsOutputDir": "__DYNAMIC__/.nexus/build",
      }
    `)
  })

  it(`use tsconfig.json outDir is no custom output is used`, async () => {
    await ctx.setup({
      'tsconfig.json': tsconfigContent({
        ...defaultTsConfigContent,
        compilerOptions: {
          ...defaultTsConfigContent.compilerOptions,
          outDir: 'dist',
        },
      }),
      'graphql.ts': '',
    })
    const result = await ctx.scanThrow()

    expect({
      tsOutputDir: result.build.tsOutputDir,
      startModuleInPath: result.build.startModuleInPath,
      startModuleOutPath: result.build.startModuleOutPath,
    }).toMatchInlineSnapshot(`
      Object {
        "startModuleInPath": "__DYNAMIC__/index.ts",
        "startModuleOutPath": "__DYNAMIC__/dist/index.js",
        "tsOutputDir": "__DYNAMIC__/dist",
      }
    `)
  })
  it(`override tsconfig.json outDir is a custom output is used`, async () => {
    await ctx.setup({
      'tsconfig.json': tsconfigContent({
        ...defaultTsConfigContent,
        compilerOptions: {
          ...defaultTsConfigContent.compilerOptions,
          outDir: 'dist',
        },
      }),
      'graphql.ts': '',
    })
    const result = await ctx.scanThrow({ buildOutput: 'custom-output' })

    expect({
      tsOutputDir: result.build.tsOutputDir,
      startModuleInPath: result.build.startModuleInPath,
      startModuleOutPath: result.build.startModuleOutPath,
    }).toMatchInlineSnapshot(`
      Object {
        "startModuleInPath": "__DYNAMIC__/index.ts",
        "startModuleOutPath": "__DYNAMIC__/custom-output/index.js",
        "tsOutputDir": "__DYNAMIC__/custom-output",
      }
    `)
  })
})

describe('source root', () => {
  it('defaults to project dir', async () => {
    ctx.setup({ 'tsconfig.json': '' })
    const result = await ctx.scanThrow()
    expect(result.sourceRoot).toEqual('__DYNAMIC__')
    expect(result.projectRoot).toEqual('__DYNAMIC__')
  })
  it('honours the value in tsconfig rootDir', async () => {
    ctx.setup({ 'tsconfig.json': tsconfigContent({ compilerOptions: { rootDir: 'api' } }) })
    const result = await ctx.scanThrow()
    expect(result.sourceRoot).toMatchInlineSnapshot(`"__DYNAMIC__/api"`)
  })
})

describe.only('scanProjectType', () => {
  const pjdata = { version: '0.0.0', name: 'foo' }
  const nestTmpDir = () => {
    const projectRootPath = ctx.fs.path('project_root')
    ctx.fs.dir(projectRootPath)
    ctx.fs = ctx.fs.cwd(projectRootPath)
  }

  describe('if package.json with nexus dep then nexus project', () => {
    it('in cwd', async () => {
      ctx.fs.write('package.json', { ...pjdata, dependencies: { nexus: '0.0.0' } })
      const res = await Layout.scanProjectType({ cwd: ctx.fs.cwd() })
      expect(res.type).toMatchInlineSnapshot(`"NEXUS_project"`)
    })
    it('in hierarchy', async () => {
      nestTmpDir()
      ctx.fs.write('../package.json', { ...pjdata, dependencies: { nexus: '0.0.0' } })
      const res = await Layout.scanProjectType({ cwd: ctx.fs.cwd() })
      expect(res.type).toMatchInlineSnapshot(`"NEXUS_project"`)
    })
  })

  describe('if package.json without nexus dep then node project', () => {
    it('in cwd', async () => {
      ctx.fs.write('package.json', { ...pjdata, dependencies: {} })
      const res = await Layout.scanProjectType({ cwd: ctx.fs.cwd() })
      expect(res.type).toMatchInlineSnapshot(`"node_project"`)
    })
    it('in hierarchy', async () => {
      nestTmpDir()
      ctx.fs.write('../package.json', { ...pjdata, dependencies: {} })
      const res = await Layout.scanProjectType({ cwd: ctx.fs.cwd() })
      expect(res.type).toMatchInlineSnapshot(`"node_project"`)
    })
  })

  it('if no package.json and dir is empty then new project', async () => {
    const res = await Layout.scanProjectType({ cwd: ctx.fs.cwd() })
    expect(res.type).toMatchInlineSnapshot(`"new"`)
  })
  it('if no package.json and dir is not empty then unknown project', async () => {
    ctx.fs.write('foo.txt', 'bar')
    const res = await Layout.scanProjectType({ cwd: ctx.fs.cwd() })
    expect(res.type).toMatchInlineSnapshot(`"unknown"`)
  })
  describe('if malformed package.json then error', () => {
    it('in cwd', async () => {
      ctx.fs.write('package.json', 'bad')
      const res = await Layout.scanProjectType({ cwd: ctx.fs.cwd() })
      expect(res.type).toMatchInlineSnapshot(`"malformed_package_json"`)
    })
    it('in hierarchy', async () => {
      nestTmpDir()
      ctx.fs.write('../package.json', 'bad')
      const res = await Layout.scanProjectType({ cwd: ctx.fs.cwd() })
      expect(res.type).toMatchInlineSnapshot(`"malformed_package_json"`)
    })
  })
})
