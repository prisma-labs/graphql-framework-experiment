import { Either, left, right } from 'fp-ts/lib/Either'
import * as fs from 'fs-jetpack'
import Lo from 'lodash'
import * as path from 'path'
import * as Path from 'path'
import { addHook } from 'pirates'
import slash from 'slash'
import * as sourceMapSupport from 'source-map-support'
import * as TSM from 'ts-morph'
import * as tsm from 'ts-morph'
import * as ts from 'typescript'
import { Layout } from './layout'
import { rootLogger } from './nexus-logger'
import { exception, Exception } from './utils'

const log = rootLogger.child('tsc')

interface ProgramOptions {
  withCache?: boolean
}

/**
 * Create a TypeScript program.
 */
export function createTSProject(layout: Layout, options?: ProgramOptions): Either<Exception, tsm.Project> {
  // Incremental option cannot be set when `noEmit: true`
  const compilerCacheOptions =
    options?.withCache && !layout.tsConfig.content.options.noEmit
      ? {
          tsBuildInfoFile: getTSIncrementalFilePath(layout),
          incremental: true,
        }
      : {}

  log.trace('Create TypeScript program')

  const tsconfigOptions = {
    ...compilerCacheOptions,
    ...layout.tsConfig.content.options,
    outDir: layout.build.tsOutputDir,
  }

  const project = new tsm.Project({
    compilerOptions: tsconfigOptions,
  })

  project.addSourceFilesAtPaths(layout.nexusModules.concat(layout.app.exists ? [layout.app.path] : []))

  // If the program has imports to modules outside the source root then TS out root will be forced
  // into an unexpected layout, and consequently the start module imports will fail. Check for this
  // specific kind of error now. All other error checking will be deferred until after typegen has been run however.
  // todo testme

  const SOURCE_ROOT_MUST_CONTAIN_ALL_SOURCE_FILES_ERROR_CODE = 6059
  const errors = project.getPreEmitDiagnostics() //ts.getPreEmitDiagnostics(builder2.getProgram())
  const maybeSourceRootMustContainAllSourceFilesError = errors.find(
    (error) => error.getCode() === SOURCE_ROOT_MUST_CONTAIN_ALL_SOURCE_FILES_ERROR_CODE
  )
  if (maybeSourceRootMustContainAllSourceFilesError) {
    const message =
      'Your app is invalid\n\n' +
      project.formatDiagnosticsWithColorAndContext([maybeSourceRootMustContainAllSourceFilesError])
    return left(exception(message))
  }

  return right(project)
}

export function deleteTSIncrementalFile(layout: Layout) {
  fs.remove(getTSIncrementalFilePath(layout))
}

export function getTSIncrementalFilePath(layout: Layout) {
  return layout.projectPath('node_modules', '.nexus', 'cache.tsbuildinfo')
}

interface CompileOptions {
  skipTSErrors?: boolean
  removePreviousBuild?: boolean
}

/**
 * compile a program. Throws an error if the program does not type check.
 */
export function emitTSProgram(
  project: tsm.Project, // ts.EmitAndSemanticDiagnosticsBuilderProgram,
  layout: Layout,
  options?: CompileOptions
): void {
  if (options?.removePreviousBuild === true) {
    log.trace('remove previous build folder if present')
    fs.remove(layout.build.tsOutputDir)
  }

  log.trace('emit transpiled modules', { dest: layout.build.tsOutputDir })

  const emitResult = project.emitSync()
  log.trace('done', { filesEmitted: emitResult.compilerObject.emittedFiles?.length ?? 0 })

  if (options?.skipTSErrors === true) {
    return
  }

  const allDiagnostics = project.getPreEmitDiagnostics().concat(emitResult.getDiagnostics())

  if (allDiagnostics.length > 0) {
    console.log(project.formatDiagnosticsWithColorAndContext(allDiagnostics))
    throw new Error(project.formatDiagnosticsWithColorAndContext(allDiagnostics))
  }
}

/**
 * Transpile a TS module to JS.
 */
export function transpileModule(input: string, compilerOptions: ts.CompilerOptions): string {
  // todo use layout and get tsconfig settings from there?
  return ts.transpileModule(input, { compilerOptions }).outputText
}

const diagnosticHost: ts.FormatDiagnosticsHost = {
  getNewLine: () => ts.sys.newLine,
  getCurrentDirectory: () => process.cwd(),
  getCanonicalFileName: (path) => path,
}

class TSError extends Error {
  constructor(public message: string) {
    super(message)

    // Make sure `name` property is not enumerable
    // so that it doesn't end up in console.log
    Object.defineProperty(this, 'name', {
      value: 'TSError',
      enumerable: false,
    })
  }
}

function createTSError(diagnostics: ReadonlyArray<ts.Diagnostic>) {
  const diagnosticText = ts.formatDiagnosticsWithColorAndContext(diagnostics, diagnosticHost)

  return new TSError(`⨯ Unable to compile TypeScript:\n${diagnosticText}`)
}

/**
 * Allow node to require TypeScript modules, transpiling them on the fly.
 *
 * @remarks
 *
 * This is strictly about transpilation, no type checking is done.
 */
export function registerTypeScriptTranspile(compilerOptions?: ts.CompilerOptions) {
  const outputCache = new Map<
    string,
    {
      content: string
    }
  >()
  const options = compilerOptions ?? {}
  sourceMapSupport.install({
    environment: 'node',
    retrieveFile(path) {
      return outputCache.get(slash(path))?.content || ''
    },
  })

  /**
   * Get the extension for a transpiled file.
   */
  const getExtension =
    options.jsx === ts.JsxEmit.Preserve
      ? (path: string) => (/\.[tj]sx$/.test(path) ? '.jsx' : '.js')
      : (_: string) => '.js'

  addHook(
    (source, fileName) => {
      const transpiled = ts.transpileModule(source, {
        reportDiagnostics: true,
        fileName,
        compilerOptions: {
          ...options,
          sourceMap: true,
        },
      })

      if (transpiled.diagnostics && transpiled.diagnostics.length > 0) {
        throw createTSError(transpiled.diagnostics)
      }

      const normalizedFileName = slash(fileName)
      const output = updateOutput(
        transpiled.outputText,
        normalizedFileName,
        transpiled.sourceMapText!,
        getExtension
      )
      outputCache.set(normalizedFileName, { content: output })

      return transpiled.outputText
    },
    { exts: ['.ts'] }
  )
}

/**
 * Update the output remapping the source map.
 * Taken from ts-node
 */
function updateOutput(
  outputText: string,
  fileName: string,
  sourceMap: string,
  getExtension: (fileName: string) => string
) {
  const base64Map = Buffer.from(updateSourceMap(sourceMap, fileName), 'utf8').toString('base64')
  const sourceMapContent = `data:application/json;charset=utf-8;base64,${base64Map}`
  const sourceMapLength =
    `${path.basename(fileName)}.map`.length + (getExtension(fileName).length - path.extname(fileName).length)

  return outputText.slice(0, -sourceMapLength) + sourceMapContent
}

/**
 * Update the source map contents for improved output.
 * Taken from ts-node
 */
function updateSourceMap(sourceMapText: string, fileName: string) {
  const sourceMap = JSON.parse(sourceMapText)
  sourceMap.file = fileName
  sourceMap.sources = [fileName]
  delete sourceMap.sourceRoot
  return JSON.stringify(sourceMap)
}

/**
 * Given a type, if it is a Promise, return the inner type. Otherwise just returns the given type as is (passthrough).
 *
 * Does not recursively unwrap Promise types. Only the first Promise, if one, is unwrapped.
 */
export function unwrapMaybePromise(type: TSM.Type) {
  if (type.getSymbol()?.getName() === 'Promise') {
    const typeArgs = type.getTypeArguments()
    if (typeArgs.length > 0) {
      const wrappedType = typeArgs[0]

      return wrappedType
    }
  }

  return type
}

/**
 * Check if the members of a union type are mergable. Only unions of interfaces and/or objects are considered mergable.
 */
export function isMergableUnion(type: TSM.Type): boolean {
  return type.isUnion() && type.getUnionTypes().every((t) => t.isObject() || t.isInterface())
}

/**
 * Merge a mergable union type into a single object. Returned as a string representation of TypeScript code. The given type should be validated by `isMergableUnion` first. The algorithm has the following rules:
 *
 * - A field with the same type accross all members results in simply that field
 * - A field with different types between members results in a union merge
 * - A field not shared by all members makes the field become optional
 * - A field shared by all members but is optional in one or more members makes the field become optional
 * - Field overloads are not supported, only the first declaration is considered
 *
 * @remarks This is useful in cases where you want to accept some user data and extract a single object type from it. What cases would single object types be explicitly desired over union types? One use-case is GraphQL context data. Its highly unlikely a user wants the context parameter of their resolver to be a union of types. Especially if the data contributions toward that type are not wholly owned by the user (e.g. plugins). Yet, users can and so will sometimes contribute data that leads to union types, for example because of conditional logic.
 *
 * TL;DR In general it is a bad idea to merge union members, but in some particular API design cases, the intent being modelled may warrant an exception.
 */
export function mergeUnionTypes(type: TSM.Type) {
  type PropertyInfo = { isOptional: boolean; type: string }

  const unionTypes = type.getUnionTypes()

  if (Lo.isEmpty(unionTypes)) return '{ }'

  const stringifiedProps = Lo.chain(unionTypes)
    .reduce((acc, u) => {
      u.getProperties().forEach((p) => {
        const name = p.getName()
        const isOptional = p.hasFlags(TSM.ts.SymbolFlags.Optional)
        const propertyType = p
          .getDeclarations()[0]
          .getType()
          .getText(undefined, TSM.ts.TypeFormatFlags.NoTruncation)

        if (!acc[name]) {
          acc[name] = []
        }

        acc[name].push({ isOptional, type: propertyType })
      })
      return acc
    }, {} as Record<string, PropertyInfo[]>)
    .entries()
    .map(([name, propertiesInfo]) => {
      // If a property is not present across all members of the union type, force it to be optional
      const isOptional =
        propertiesInfo.length !== unionTypes.length ? true : propertiesInfo.some((p) => p.isOptional)
      const typesOfProperty = Lo(propertiesInfo)
        .flatMap((p) => p.type.split(' | '))
        .uniq()
        .value()
        .join(' | ')

      return `${name}${isOptional ? '?' : ''}: ${typesOfProperty};`
    })
    .value()
    .join(' ')

  return `{ ${stringifiedProps} }`
}

/**
 * Given a SourceFile get the absolute ID by which it would be imported.
 */
export function getAbsoluteImportPath(sourceFile: TSM.SourceFile) {
  // NOTE TypeScript paths always work in terms of forwrd slashes, even on windows
  // We rely on this normalization in path checks below.

  let isNode = false
  let modulePath = Path.join(Path.dirname(sourceFile.getFilePath()), sourceFile.getBaseNameWithoutExtension())

  const nodeModule = modulePath.match(/node_modules\/@types\/node\/(.+)/)?.[1]
  if (nodeModule) {
    modulePath = nodeModule
    isNode = true
  } else {
    const externalPackage = modulePath.match(/node_modules\/@types\/(.+)/)?.[1]
    if (externalPackage) {
      modulePath = externalPackage
    }
  }

  return { isNode, modulePath }
}

/**
 * Find the modules in the project that import the given dep and return info about how that dep is imported along with sourceFile ref itself.
 */
export function findModulesThatImportModule(project: TSM.Project, id: string) {
  const data: ModulesWithImportSearchResult[] = []

  for (const sourceFile of project.getSourceFiles()) {
    // TODO: if project folder contains "node_modules" in it, nexus modules won't be found
    if (sourceFile.getFilePath().includes('node_modules')) continue
    let entry: ModulesWithImportSearchResult
    for (const importDec of sourceFile.getImportDeclarations()) {
      if (getImportId(importDec) === id) {
        entry = entry! ?? { sourceFile, imports: [] }
        const namedImports = importDec.getNamedImports()
        const defaultImport = importDec.getDefaultImport() ?? null
        entry.imports.push({
          default: defaultImport,
          named:
            namedImports.length === 0
              ? null
              : namedImports.map((namedImport) => ({
                  name: namedImport.getName(),
                  alias: namedImport.getAliasNode()?.getText() ?? null,
                })),
        })
      }
    }
    if (entry!) data.push(entry!)
  }

  return data
}

/**
 * Gets the module id being imported. Syntax like quotes is stripped.
 */
function getImportId(importDec: TSM.ImportDeclaration) {
  return importDec
    .getModuleSpecifier()
    .getText()
    .replace(/^['"]|['"]$/g, '')
}

/**
 * - "imports" list is non-empty array.
 * - At least one of import props "default" or "named" will be non-null, possibly both
 */
export type ModulesWithImportSearchResult = {
  sourceFile: TSM.SourceFile
  imports: {
    default: null | TSM.Identifier
    named: null | { alias: null | string; name: string }[]
  }[]
}
