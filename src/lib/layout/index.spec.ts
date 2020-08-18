import { log } from '@nexus/logger'
import 'jest-extended'
import { defaultsDeep } from 'lodash'
import * as Path from 'path'
import { TsConfigJson } from 'type-fest'
import * as Layout from '.'
import { FSSpec, writeFSSpec } from '../../lib/testing-utils'
import * as TC from '../test-context'
import { leftOrThrow, normalizePathsInData, repalceInObject, replaceEvery, rightOrThrow } from '../utils'
import { NEXUS_TS_LSP_IMPORT_ID } from './tsconfig'

let logs: string = ''

log.settings({
  output: {
    write(data) {
      logs += data
    },
  },
})

afterEach(() => {
  logs = ''
})

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

function tsconfig(input?: TsConfigJson): TsConfigJson {
  const defaultTsConfigContent: TsConfigJson = {
    compilerOptions: {
      noEmit: true,
      rootDir: '.',
      plugins: [{ name: NEXUS_TS_LSP_IMPORT_ID }],
      typeRoots: ['node_modules/@types', 'types'],
      esModuleInterop: true,
    },
    include: ['types.d.ts', '.'],
  }
  return defaultsDeep(input, defaultTsConfigContent)
}

/**
 * Create tsconfig content. Defaults to minimum valid tsconfig needed by Nexus. Passed config will override and merge using lodash deep defaults.
 */
function tsconfigSource(input?: TsConfigJson): string {
  return JSON.stringify(tsconfig(input))
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
      async createLayoutThrow(opts?: { entrypointPath?: string; buildOutput?: string }) {
        const data = rightOrThrow(
          await Layout.create({
            projectRoot: ctx.fs.cwd(),
            entrypointPath: opts?.entrypointPath,
            buildOutputDir: opts?.buildOutput,
            asBundle: false,
          })
        )
        logs = replaceEvery(logs, ctx.fs.cwd(), '__DYNAMIC__')
        return normalizePathsInData(data.data, ctx.fs.cwd(), '__DYNAMIC__')
      },
      async createLayout2(opts?: { entrypointPath?: string; buildOutput?: string }) {
        return Layout.create({
          projectRoot: ctx.fs.cwd(),
          entrypointPath: opts?.entrypointPath,
          buildOutputDir: opts?.buildOutput,
          asBundle: false,
        })
      },
      async createLayout(opts?: { entrypointPath?: string; buildOutput?: string }) {
        return Layout.create({
          projectRoot: ctx.fs.cwd(),
          entrypointPath: opts?.entrypointPath,
          buildOutputDir: opts?.buildOutput,
          asBundle: false,
        }).then((v) => {
          return normalizePathsInData(v, ctx.fs.cwd(), '__DYNAMIC__')
        })
      },
    }
  })
)

const nestTmpDir = () => {
  const projectRootPath = ctx.fs.path('project-root')
  ctx.fs.dir(projectRootPath)
  ctx.fs = ctx.fs.cwd(projectRootPath)
}

/**
 * Tests
 */

describe('projectRoot', () => {
  it('can be forced', () => {
    const projectRoot = ctx.fs.path('./foobar')
    ctx.fs.write('./foobar/app.ts', '')
    ctx.fs.dir(projectRoot)
    expect(Layout.create({ projectRoot }).then(rightOrThrow)).resolves.toMatchObject({ projectRoot })
  })
  it('otherwise uses first dir in hierarchy with a package.json', () => {
    nestTmpDir()
    ctx.fs.write('../package.json', { version: '0.0.0', name: 'foo' })
    ctx.fs.write('app.ts', '')
    expect(Layout.create({ cwd: ctx.fs.cwd() }).then(rightOrThrow)).resolves.toMatchObject({
      projectRoot: ctx.fs.path('..'),
    })
  })
  it('otherwise finally falls back to process cwd', () => {
    ctx.fs.write('app.ts', '')
    expect(Layout.create({ cwd: ctx.fs.cwd() }).then(rightOrThrow)).resolves.toMatchObject({
      projectRoot: ctx.fs.cwd(),
    })
  })
})

describe('sourceRoot', () => {
  it('defaults to project dir', async () => {
    ctx.setup({ 'tsconfig.json': '', 'app.ts': '' })
    const res = await ctx.createLayout().then(rightOrThrow)
    expect(res.sourceRoot).toEqual('__DYNAMIC__')
    expect(res.projectRoot).toEqual('__DYNAMIC__')
  })
  it('uses the value in tsconfig compilerOptions.rootDir if present', async () => {
    ctx.setup({ 'tsconfig.json': tsconfigSource({ compilerOptions: { rootDir: 'api' } }), 'api/app.ts': '' })
    const res = await ctx.createLayout().then(rightOrThrow)
    expect(res.sourceRoot).toEqual(Path.posix.join('__DYNAMIC__/api'))
  })
})

describe('tsconfig', () => {
  beforeEach(() => {
    ctx.setup({ 'app.ts': '' })
  })

  it('warns if "types.d.ts" is missing from include', async () => {
    ctx.setup({
      'tsconfig.json': tsconfigSource({ include: ['.'] }),
    })
    await ctx.createLayoutThrow()
    expect(logs).toMatchInlineSnapshot(`
      "▲ nexus:tsconfig Please add [93m\\"types.d.ts\\"[39m to your [93m\\"include\\"[39m array. If you do not then results from Nexus and your IDE will not agree if the declaration file is used in your project.
      "
    `)
  })

  it('fails if tsconfig settings does not lead to matching any source files', async () => {
    ctx.fs.remove('app.ts')
    const res = await ctx.createLayout().then(leftOrThrow)
    expect(res).toMatchInlineSnapshot(`
      Object {
        "context": Object {
          "diagnostics": Array [
            Object {
              "category": 1,
              "code": 18003,
              "file": undefined,
              "length": undefined,
              "messageText": "No inputs were found in config file '__DYNAMIC__/tsconfig.json'. Specified 'include' paths were '[\\"types.d.ts\\",\\".\\"]' and 'exclude' paths were '[]'.",
              "reportsUnnecessary": undefined,
              "start": undefined,
            },
          ],
        },
        "type": "invalid_tsconfig",
      }
    `)
  })

  it('will scaffold tsconfig if not present', async () => {
    await ctx.createLayoutThrow()
    expect(normalizePathsInData(logs)).toMatchInlineSnapshot(`
      "▲ nexus:tsconfig We could not find a \\"tsconfig.json\\" file
      ▲ nexus:tsconfig We scaffolded one for you at __DYNAMIC__/tsconfig.json
      "
    `)
    expect(ctx.fs.read('tsconfig.json', 'json')).toMatchInlineSnapshot(`
      Object {
        "compilerOptions": Object {
          "esModuleInterop": true,
          "lib": Array [
            "esnext",
          ],
          "module": "commonjs",
          "noEmit": true,
          "plugins": Array [
            Object {
              "name": "nexus/typescript-language-service",
            },
          ],
          "rootDir": ".",
          "strict": true,
          "target": "es2016",
          "typeRoots": Array [
            "node_modules/@types",
            "types",
          ],
        },
        "include": Array [
          "types.d.ts",
          ".",
        ],
      }
    `)
  })

  describe('composite projects', () => {
    it('inheritable settings are recognized but "include", "rootDir", "plugins", "typeRoots" must be local', async () => {
      nestTmpDir()
      ctx.fs.write('src/app.ts', '')
      ctx.fs.write('../tsconfig.packages.json', tsconfigSource())
      ctx.fs.write('tsconfig.json', {
        extends: '../tsconfig.packages.json',
      } as TsConfigJson)
      await ctx.createLayoutThrow()
      expect(logs).toMatchInlineSnapshot(`
        "▲ nexus:tsconfig You have not setup the Nexus TypeScript Language Service Plugin. Add this to your compiler options:

            \\"plugins\\": [{ \\"name\\": \\"nexus/typescript-language-service\\" }]

        ▲ nexus:tsconfig Please set [93m\`compilerOptions.typeRoots\`[39m to [93m[\\"node_modules/@types\\",\\"types\\"][39m. \\"node_modules/@types\\" is the TypeScript default for types packages and where Nexus outputs typegen to. \\"types\\" is the Nexus convention for _local_ types packages.
        ▲ nexus:tsconfig Please add [93m\\"types.d.ts\\"[39m to your [93m\\"include\\"[39m array. If you do not then results from Nexus and your IDE will not agree if the declaration file is used in your project.
        ▲ nexus:tsconfig Please set [93m\`compilerOptions.rootDir\`[39m to [93m\\".\\"[39m
        ▲ nexus:tsconfig Please set [93m\`include\`[39m to have \\".\\"
        "
      `)
    })
  })

  describe('no emit', () => {
    it('warns if "noEmit" is not true (explicit false), and sets "noEmit" to false in memory', async () => {
      ctx.setup({
        'tsconfig.json': tsconfigSource({ compilerOptions: { noEmit: false } }),
      })
      const res = await ctx.createLayoutThrow()
      expect(logs).toMatchInlineSnapshot(`
        "▲ nexus:tsconfig Please set [93m\`compilerOptions.noEmit\`[39m to true. This will ensure you do not accidentally emit using [93m\`$ tsc\`[39m. Use [93m\`$ nexus build\`[39m to build your app and emit JavaScript.
        "
      `)
      expect(res.tsConfig.content.options.noEmit).toEqual(false)
    })
    it('warns if "noEmit" is not true (undefined), and sets "noEmit" to false in memory', async () => {
      const tscfg = tsconfig()
      delete tscfg.compilerOptions?.noEmit

      ctx.setup({
        'tsconfig.json': JSON.stringify(tscfg),
      })
      const res = await ctx.createLayoutThrow()
      expect(logs).toMatchInlineSnapshot(`
        "▲ nexus:tsconfig Please set [93m\`compilerOptions.noEmit\`[39m to true. This will ensure you do not accidentally emit using [93m\`$ tsc\`[39m. Use [93m\`$ nexus build\`[39m to build your app and emit JavaScript.
        "
      `)
      expect(res.tsConfig.content.options.noEmit).toEqual(false)
    })
  })
  describe('linting', () => {
    it('warns if reserved settings are in use', async () => {
      ctx.setup({
        'tsconfig.json': tsconfigSource({
          compilerOptions: {
            incremental: true,
            tsBuildInfoFile: 'foo',
          },
        }),
      })
      await ctx.createLayoutThrow()
      expect(logs).toMatchInlineSnapshot(`
        "▲ nexus:tsconfig You have set [93m\`compilerOptions.tsBuildInfoFile\`[39m but it will be ignored by Nexus. Nexus manages this value internally.
        ▲ nexus:tsconfig You have set [93m\`compilerOptions.incremental\`[39m but it will be ignored by Nexus. Nexus manages this value internally.
        "
      `)
    })
    it('warns if rootDir or include not set and sets them in memory', async () => {
      const tscfg = tsconfig()
      delete tscfg.compilerOptions?.rootDir
      delete tscfg.include

      ctx.setup({
        'tsconfig.json': JSON.stringify(tscfg),
      })
      const layout = await ctx.createLayoutThrow()
      expect(logs).toMatchInlineSnapshot(`
        "▲ nexus:tsconfig Please add [93m\\"types.d.ts\\"[39m to your [93m\\"include\\"[39m array. If you do not then results from Nexus and your IDE will not agree if the declaration file is used in your project.
        ▲ nexus:tsconfig Please set [93m\`compilerOptions.rootDir\`[39m to [93m\\".\\"[39m
        ▲ nexus:tsconfig Please set [93m\`include\`[39m to have \\".\\"
        "
      `)
      expect(layout.tsConfig.content.raw.compilerOptions.rootDir).toEqual('.')
      expect(layout.tsConfig.content.raw.include).toEqual(['types.d.ts', '.'])
    })
    it('need the Nexus TS LSP setup', async () => {
      ctx.setup({
        'tsconfig.json': tsconfigSource({
          compilerOptions: { plugins: [{ name: 'foobar' }] },
        }),
      })

      await ctx.createLayoutThrow()
      expect(logs).toMatchInlineSnapshot(`
        "▲ nexus:tsconfig You have not added the Nexus TypeScript Language Service Plugin to your configured TypeScript plugins. Add this to your compilerOptions:

            [93m\\"plugins\\": [{\\"name\\":\\"foobar\\"},{\\"name\\":\\"nexus/typescript-language-service\\"}][39m

        "
      `)
    })
    it('does not support use of compilerOptions.types', async () => {
      ctx.setup({
        'tsconfig.json': tsconfigSource({ compilerOptions: { types: [] } }),
      })
      await ctx.createLayoutThrow()
      expect(logs).toMatchInlineSnapshot(`
        "■ nexus:tsconfig You have set [93m\`compilerOptions.types\`[39m but Nexus does not support it. If you do not remove your customization you may/will (e.g. VSCode) see inconsistent results between your IDE and what Nexus tells you at build time. If you would like to see Nexus support this setting please chime in at https://github.com/graphql-nexus/nexus/issues/1036.
        "
      `)
    })

    describe('typeRoots', () => {
      it('logs error if typeRoots present but missing "node_modules/@types", and adds it in-memory', async () => {
        const tscfg = tsconfig()
        tscfg.compilerOptions!.typeRoots = ['types']
        ctx.setup({
          'tsconfig.json': JSON.stringify(tscfg),
        })
        const res = await ctx.createLayout2().then(rightOrThrow)
        expect(logs).toMatchInlineSnapshot(`
          "■ nexus:tsconfig Please add [93m\\"node_modules/@types\\"[39m to your [93m\`compilerOptions.typeRoots\`[39m array. 
          "
        `)
        // todo normalize in layout module???
        expect(res.tsConfig.content.options.typeRoots?.map(Path.normalize)).toIncludeSameMembers(
          ['types', 'node_modules/@types'].map((relPath) => ctx.fs.path(relPath))
        )
      })
      it('logs warning if "typeRoots" present but missing "types", and adds it in-memory', async () => {
        const tscfg = tsconfig()
        tscfg.compilerOptions!.typeRoots = ['node_modules/@types']
        ctx.setup({
          'tsconfig.json': JSON.stringify(tscfg),
        })
        const res = await ctx.createLayout2().then(rightOrThrow)
        expect(logs).toMatchInlineSnapshot(`
          "▲ nexus:tsconfig Please add [93m\\"types\\"[39m to your [93m\`compilerOptions.typeRoots\`[39m array. 
          "
        `)
        expect(res.tsConfig.content.options.typeRoots?.map(Path.normalize)).toIncludeSameMembers(
          ['types', 'node_modules/@types'].map((relPath) => ctx.fs.path(relPath))
        )
      })
      it('logs warning if "typeRoots" missing, and add its in-memory', async () => {
        const tscfg = tsconfig()
        delete tscfg.compilerOptions!.typeRoots
        ctx.setup({
          'tsconfig.json': JSON.stringify(tscfg),
        })
        const res = await ctx.createLayout2().then(rightOrThrow)
        expect(logs).toMatchInlineSnapshot(`
          "▲ nexus:tsconfig Please set [93m\`compilerOptions.typeRoots\`[39m to [93m[\\"node_modules/@types\\",\\"types\\"][39m. \\"node_modules/@types\\" is the TypeScript default for types packages and where Nexus outputs typegen to. \\"types\\" is the Nexus convention for _local_ types packages.
          "
        `)
        expect(res.tsConfig.content.options.typeRoots?.map(Path.normalize)).toIncludeSameMembers(
          ['node_modules/@types', 'types'].map((relPath) => ctx.fs.path(relPath))
        )
      })
      it('preserves any "typeRoot" settings present', async () => {
        const tscfg = tsconfig()
        tscfg.compilerOptions!.typeRoots = ['node_modules/@types', 'custom']
        ctx.setup({
          'tsconfig.json': JSON.stringify(tscfg),
        })
        const res = await ctx.createLayout2().then(rightOrThrow)
        expect(logs).toMatchInlineSnapshot(`
          "▲ nexus:tsconfig Please add [93m\\"types\\"[39m to your [93m\`compilerOptions.typeRoots\`[39m array. 
          "
        `)
        expect(res.tsConfig.content.options.typeRoots?.map(Path.normalize)).toIncludeSameMembers(
          ['node_modules/@types', 'custom', 'types'].map((relPath) => ctx.fs.path(relPath))
        )
      })
    })
  })

  it('will return exception if error reading file', async () => {
    ctx.setup({
      'tsconfig.json': 'bad json',
    })
    const res = await ctx.createLayout2().then(leftOrThrow)
    expect(res).toMatchObject({
      context: {},
      type: 'generic',
      message: expect.stringMatching(".*error.*TS1005.*'{' expected"),
    })
  })

  it('will return exception if invalid tsconfig schema', async () => {
    ctx.setup({
      'tsconfig.json': '{ "exclude": "bad" }',
    })
    const res = await ctx.createLayout().then(leftOrThrow)
    expect(res).toMatchInlineSnapshot(`
      Object {
        "context": Object {
          "diagnostics": Array [
            Object {
              "category": 1,
              "code": 5024,
              "file": undefined,
              "length": undefined,
              "messageText": "Compiler option 'exclude' requires a value of type Array.",
              "reportsUnnecessary": undefined,
              "start": undefined,
            },
          ],
        },
        "type": "invalid_tsconfig",
      }
    `)
  })
})

it('fails if no entrypoint and no nexus modules', async () => {
  ctx.setup({
    'tsconfig.json': tsconfigSource(),
    src: {
      'User.ts': '',
      'Post.ts': '',
    },
  })

  const res = await ctx.createLayout()

  expect(res).toMatchInlineSnapshot(`
    Object {
      "_tag": "Left",
      "left": Object {
        "context": Object {},
        "type": "no_app_or_schema_modules",
      },
    }
  `)
})

describe('nexusModules', () => {
  it('finds nested nexus modules', async () => {
    ctx.setup({
      'tsconfig.json': tsconfigSource(),
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

    const result = await ctx.createLayout2().then(rightOrThrow)

    expect(result.nexusModules).toIncludeSameMembers(
      [
        'src/graphql/1.ts',
        'src/graphql/2.ts',
        'src/graphql/graphql/3.ts',
        'src/graphql/graphql/4.ts',
        'src/graphql/graphql/graphql/5.ts',
        'src/graphql/graphql/graphql/6.ts',
      ].map((relPath) => ctx.fs.path(relPath))
    )
  })

  it('does not take custom entrypoint as nexus module if contains a nexus import', async () => {
    await ctx.setup({
      'tsconfig.json': tsconfigSource(),
      'app.ts': `import { schema } from 'nexus'`,
      'graphql.ts': `import { schema } from 'nexus'`,
    })
    const result = await ctx.createLayout2({ entrypointPath: './app.ts' }).then(rightOrThrow)
    // result.nexusModules
    expect(result).toMatchObject({
      app: {
        exists: true,
        path: expect.stringContaining(ctx.fs.path('app.ts')),
      },
      nexusModules: [ctx.fs.path('graphql.ts')],
    })
  })
})

describe('packageManagerType', () => {
  it('detects yarn as package manager', async () => {
    ctx.setup({ 'tsconfig.json': tsconfigSource(), 'app.ts': '', 'yarn.lock': '' })
    const result = await ctx.createLayoutThrow()
    expect(result.packageManagerType).toMatchInlineSnapshot(`"yarn"`)
  })
})

describe('entrypoint', () => {
  it('finds app.ts entrypoint', async () => {
    ctx.setup({ 'tsconfig.json': tsconfigSource(), 'app.ts': '' })
    const result = await ctx.createLayoutThrow()
    expect(result.app).toMatchInlineSnapshot(`
          Object {
            "exists": true,
            "path": "__DYNAMIC__/app.ts",
          }
      `)
  })

  it('set app.exists = false if no entrypoint', async () => {
    await ctx.setup({ 'tsconfig.json': tsconfigSource(), 'foo.ts': 'import "nexus"' })
    const result = await ctx.createLayoutThrow()
    expect(result.app).toMatchInlineSnapshot(`
          Object {
            "exists": false,
            "path": null,
          }
      `)
  })

  it('uses custom relative entrypoint when defined', async () => {
    await ctx.setup({ 'tsconfig.json': tsconfigSource(), 'index.ts': `console.log('entrypoint')` })
    const result = await ctx.createLayoutThrow({ entrypointPath: './index.ts' })
    expect(result.app).toMatchInlineSnapshot(`
          Object {
            "exists": true,
            "path": "__DYNAMIC__/index.ts",
          }
      `)
  })

  it('uses custom absolute entrypoint when defined', async () => {
    await ctx.setup({ 'tsconfig.json': tsconfigSource(), 'index.ts': `console.log('entrypoint')` })
    const result = await ctx.createLayoutThrow({ entrypointPath: ctx.fs.path('index.ts') })
    expect(result.app).toMatchInlineSnapshot(`
          Object {
            "exists": true,
            "path": "__DYNAMIC__/index.ts",
          }
      `)
  })

  it('fails if custom entrypoint does not exist', async () => {
    await ctx.setup({ 'tsconfig.json': tsconfigSource(), 'index.ts': `console.log('entrypoint')` })
    const result = await ctx.createLayout({ entrypointPath: './wrong-path.ts' })
    expect(JSON.stringify(result)).toMatchInlineSnapshot(
      `"{\\"_tag\\":\\"Left\\",\\"left\\":{\\"message\\":\\"Entrypoint does not exist\\",\\"context\\":{\\"path\\":\\"__DYNAMIC__/wrong-path.ts\\"},\\"type\\":\\"generic\\"}}"`
    )
  })

  it('fails if custom entrypoint is not a .ts file', async () => {
    await ctx.setup({
      'tsconfig.json': tsconfigSource(),
      'index.ts': ``,
      'index.js': `console.log('entrypoint')`,
    })
    const result = await ctx.createLayout({ entrypointPath: './index.js' })
    expect(JSON.stringify(result)).toMatchInlineSnapshot(
      `"{\\"_tag\\":\\"Left\\",\\"left\\":{\\"message\\":\\"Entrypoint must be a .ts file\\",\\"context\\":{\\"path\\":\\"__DYNAMIC__/index.js\\"},\\"type\\":\\"generic\\"}}"`
    )
  })
})

describe('build', () => {
  it(`defaults to .nexus/build`, async () => {
    await ctx.setup({ 'tsconfig.json': tsconfigSource(), 'foo.ts': 'import "nexus"' })
    const result = await ctx.createLayoutThrow()
    expect(result).toMatchObject({
      build: {
        startModuleInPath: '__DYNAMIC__/index.ts',
        startModuleOutPath: '__DYNAMIC__/.nexus/build/index.js',
        tsOutputDir: '__DYNAMIC__/.nexus/build',
      },
    })
  })

  it(`use tsconfig.json outDir is no custom output is used`, async () => {
    await ctx.setup({
      'tsconfig.json': tsconfigSource({
        compilerOptions: {
          outDir: 'dist',
        },
      }),
      'foo.ts': 'import "nexus"',
    })
    const result = await ctx.createLayout2().then(rightOrThrow)
    expect(result).toMatchObject({
      build: {
        startModuleInPath: ctx.fs.path('index.ts'),
        startModuleOutPath: ctx.fs.path('dist/index.js'),
        tsOutputDir: ctx.fs.path('dist'),
      },
    })
  })
  it(`override tsconfig.json outDir is a custom output is used`, async () => {
    await ctx.setup({
      'tsconfig.json': tsconfigSource({
        compilerOptions: {
          outDir: 'dist',
        },
      }),
      'foo.ts': 'import "nexus"',
    })
    const result = await ctx.createLayoutThrow({ buildOutput: 'custom-output' })

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

describe('scanProjectType', () => {
  const pjdata = { version: '0.0.0', name: 'foo' }

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
