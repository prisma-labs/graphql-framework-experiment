import * as HTTP from 'http'
import { clone, isArray, isPlainObject, isString } from 'lodash'
import Module from 'module'
import * as Net from 'net'
import * as Path from 'path'
import Git from 'simple-git/promise'
import slash from 'slash'
import { JsonObject, PackageJson, Primitive } from 'type-fest'

export * from './either'

export type MaybePromise<T = void> = T | Promise<T>

export type CallbackRegistrer<F> = (f: F) => void

export type SideEffector = () => MaybePromise

export type Param1<F> = F extends (p1: infer P1, ...args: any[]) => any ? P1 : never
export type Param2<F> = F extends (p1: any, p2: infer P2, ...args: any[]) => any ? P2 : never
export type Param3<F> = F extends (p1: any, p2: any, p3: infer P3, ...args: any[]) => any ? P3 : never

/**
 * Represents a POJO. Prevents from allowing arrays and functions
 *
 * @remarks
 *
 * TypeScript interfaces will not be considered sub-types.
 */
export type PlainObject = {
  [x: string]: Primitive | object
}

/**
 * DeepPartial - modified version from `utility-types`
 * @desc Partial that works for deeply nested structure
 * @example
 *   Expect: {
 *     first?: {
 *       second?: {
 *         name?: string;
 *       };
 *     };
 *   }
 *   type NestedProps = {
 *     first: {
 *       second: {
 *         name: string;
 *       };
 *     };
 *   };
 *   type PartialNestedProps = DeepPartial<NestedProps>;
 */
export type DeepPartial<T, AllowAdditionalProps extends boolean = false> = T extends Function
  ? T
  : T extends Array<infer U>
  ? DeepPartialArray<U>
  : T extends object
  ? AllowAdditionalProps extends true
    ? DeepPartialObject<T, true> & PlainObject
    : DeepPartialObject<T, false>
  : T | undefined

export interface DeepPartialArray<T> extends Array<DeepPartial<T>> {}

export type DeepPartialObject<T extends object, AllowAdditionalProps extends boolean = false> = {
  [P in keyof T]?: AllowAdditionalProps extends true
    ? DeepPartial<T[P], true> & PlainObject
    : DeepPartial<T[P], false>
}

/**
 * DeepRequired - borrowed from `utility-types`
 * @desc Required that works for deeply nested structure
 * @example
 *   Expect: {
 *     first: {
 *       second: {
 *         name: string;
 *       };
 *     };
 *   }
 *   type NestedProps = {
 *     first?: {
 *       second?: {
 *         name?: string;
 *       };
 *     };
 *   };
 *   type RequiredNestedProps = DeepRequired<NestedProps>;
 */
export declare type DeepRequired<T> = T extends (...args: any[]) => any
  ? T
  : T extends any[]
  ? DeepRequiredArray<T[number]>
  : T extends object
  ? DeepRequiredObject<T>
  : T

export type ExcludeUndefined<A> = A extends undefined ? never : A

export interface DeepRequiredArray<T> extends Array<DeepRequired<ExcludeUndefined<T>>> {}

export declare type DeepRequiredObject<T> = {
  [K in keyof T]-?: DeepRequired<ExcludeUndefined<T[K]>>
}

/**
 * Guarantee the length of a given string, padding before or after with the
 * given character. If the given string is longer than  the span target, then it
 * will be cropped.
 */
export function span(
  padSide: 'padBefore' | 'padAfter',
  padChar: string,
  target: number,
  content: string
): string {
  if (content.length > target) {
    return content.slice(0, target)
  }
  let toPadSize = target - content.length
  while (toPadSize > 0) {
    if (padSide === 'padAfter') {
      content = content + padChar
    } else if (padSide === 'padBefore') {
      content = padChar + content
    }
    toPadSize--
  }
  return content
}

/**
 * Guarantee the length of a given string, padding with space as needed. Content
 * is aligned left and if exceeds span target length to begin with gets cropped.
 */
export const clampSpace = span.bind(null, 'padAfter', ' ')

/**
 * Create a string of space of the given length.
 */
export function spanSpace(num: number): string {
  return spanChar(num, ' ')
}

/**
 * Create a string of the given length and character
 */
export function spanChar(num: number, char: string): string {
  return range(num).map(constant(char)).join('')
}

/**
 * Guarantee the length of a given string, padding with space as needed. Content
 * is aligned right and if exceeds span target length to begin with gets cropped.
 */
export const spanSpaceRight = span.bind(null, 'padBefore', ' ')

/**
 * Use this to make assertion at end of if-else chain that all members of a
 * union have been accounted for.
 */
export function casesHandled(x: never): never {
  throw new Error(`A case was not handled for value: ${x}`)
}

/**
 * Create a function that will only ever return the given value when called.
 */
export function constant<T>(x: T): () => T {
  return function () {
    return x
  }
}

/**
 * Create a range of integers.
 */
export function range(times: number): number[] {
  const list: number[] = []
  while (list.length < times) {
    list.push(list.length + 1)
  }
  return list
}

export type OmitFirstArg<Func> = Func extends (firstArg: any, ...args: infer Args) => infer Ret
  ? (...args: Args) => Ret
  : never

/**
 * Generate a randomized Nexus project name.
 */
export function generateProjectName(): string {
  return 'my-nexus-app-' + Math.random().toString().slice(2)
}

/**
 * Get the name of the CWD or if at disk root and thus making it impossible to
 * extract a meaningful name, generate one.
 */
export function CWDProjectNameOrGenerate(opts: { cwd: string } = { cwd: process.cwd() }): string {
  return Path.basename(opts.cwd) || generateProjectName()
}

/**
 * Creates a new git repository with an initial commit of all contents at the
 * time this function is run.
 */
export async function createGitRepository() {
  const git = Git()
  await git.init()
  await git.raw(['add', '-A'])
  await git.raw(['commit', '-m', 'initial commit'])
}

export function requireModule(config: { depName: string; optional: boolean }): null | unknown {
  const depPath = process.env.LINK
    ? Path.join(process.cwd(), '/node_modules/', config.depName)
    : config.depName

  try {
    const dep = require(depPath)
    // The code may have been compiled from a TS source and then may have a .default property
    if (dep.default !== undefined) {
      return dep.default
    } else {
      return dep
    }
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND' && config.optional) {
      return null
    }
    throw error
  }
}

/**
 * Check whether Worker Threads are available. In Node 10, workers aren't available by default.
 */
export function areWorkerThreadsAvailable(): boolean {
  try {
    require('worker_threads')
    return true
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      return false
    }
    throw error
  }
}

/**
 * Iterate through all values in a plain object and convert all paths into posix ones, and replace basePath if given and found with baesPathMask if given otherwise "<dynamic>".
 *
 * Special handling is given for errors, turning them into plain objects, stack and message properties dropped, enumerable props processed.
 */
export function normalizePathsInData<X>(x: X, basePath?: string, basePathMask?: string): X {
  if (isString(x)) {
    let x_: string = x
    if (basePath) {
      x_ = replaceEvery(x_, basePath, basePathMask ?? '<dynamic>')
      x_ = replaceEvery(x_, slash(basePath), basePathMask ?? '<dynamic>')
    }
    x_ = replaceEvery(x_, Path.sep, Path.posix.sep)
    return x_ as any
  }

  if (isArray(x)) {
    return x.map((item) => {
      return normalizePathsInData(item, basePath, basePathMask)
    }) as any
  }

  if (isPlainObject(x)) {
    const x_ = {} as any
    for (const [k, v] of Object.entries(x)) {
      x_[k] = normalizePathsInData(v, basePath, basePathMask)
    }
    return x_
  }

  if (x instanceof Error) {
    const x_ = clone(x)
    for (const [k, v] of Object.entries(x)) {
      const anyx_ = x_ as any
      anyx_[k] = normalizePathsInData(v, basePath, basePathMask)
    }

    return x_ as any
  }

  return x
}

// todo extends Json
export function repalceInObject<C extends object>(
  dynamicPattern: string | RegExp,
  replacement: string,
  content: C
): C {
  return JSON.parse(
    JSON.stringify(content)
      .split(JSON.stringify(dynamicPattern).replace(/^"|"$/g, ''))
      .join(replacement)
      // Normalize snapshotted paths across OSs
      // Namely turn Windows "\" into "/"
      .split(Path.sep)
      .join('/')
  )
}

export function replaceEvery(str: string, dynamicPattern: string, replacement: string): string {
  return str.split(dynamicPattern).join(replacement)
}

/**
 * Creates an array of elements split into two groups.
 * The first of which contains elements predicate returns truthy for, the second of which contains elements predicate returns falsey for.
 * The predicate is invoked with one argument: (value).
 */
export function partition<T>(array: Array<T>, predicate: (value: T) => boolean): [Array<T>, Array<T>] {
  const partitioned: [Array<T>, Array<T>] = [[], []]

  for (const value of array) {
    const partitionIndex: 0 | 1 = predicate(value) ? 0 : 1

    partitioned[partitionIndex].push(value)
  }

  return partitioned
}

/**
 * Render IPv6 `::` as localhost. By default Node servers will use :: if IPv6
 * host is available otherwise IPv4 0.0.0.0. In local development it seems that
 * rendering as localhost makes the most sense as to what the user expects.
 * According to Node docs most operating systems that are supporting IPv6
 * somehow bind `::` to `0.0.0.0` anyways.
 */
export function prettifyHost(host: string): string {
  return host === '::' ? 'localhost' : host
}

type UnPromisify<T> = T extends Promise<infer U> ? U : T

/**
 * Makes sure, that there is only one execution at a time
 * and the last invocation doesn't get lost (tail behavior of debounce)
 * Mostly designed for watch mode
 */
export function simpleDebounce<T extends (...args: any[]) => Promise<any>>(
  fn: T
): (...args: Parameters<T>) => { type: 'result'; data: UnPromisify<ReturnType<T>> } | { type: 'executing' } {
  let executing = false
  let pendingExecution: any = null
  let res: any
  return (async (...args: any[]) => {
    if (executing) {
      // if there's already an execution, make it pending
      pendingExecution = args
      return { type: 'executing' }
    }
    executing = true
    res = await fn(...args).catch((e) => console.error(e))
    if (pendingExecution) {
      res = await fn(...args).catch((e) => console.error(e))
      pendingExecution = null
    }
    executing = false
    return { type: 'result', data: res }
  }) as any
}

export type Index<T> = {
  [key: string]: T
}

/**
 * An ESM-aware reading of the main entrypoint to a package.
 */
export function getPackageJsonMain(packageJson: PackageJson & { main: string }): string {
  // todo when building for a bundler, we want to read from the esm paths. Otherwise the cjs paths.
  //  - this condition takes a stab at the problem but is basically a stub.
  //  - this todo only needs to be completed once we are actually trying to do esm tree-shaking (meaning, we've moved beyond node-file-trace)
  return process.env.ESM && packageJson.module
    ? Path.dirname(packageJson.module)
    : Path.dirname(packageJson.main)
}

export type Exception = BaseException<'generic', any>

export interface BaseException<T extends string, C extends SomeRecord> extends Error {
  type: T
  context: C
}

export function exceptionType<Type extends string, Context extends SomeRecord>(
  type: Type,
  messageOrTemplate: string | ((ctx: Context) => string)
) {
  // todo overload function (or two functions)
  // make template optional
  // if given, return factory that only accepts context
  // if not given, return factory that accepts message + context
  return (ctx: Context) => {
    const e = new Error(
      typeof messageOrTemplate === 'string' ? messageOrTemplate : messageOrTemplate(ctx)
    ) as BaseException<Type, Context>
    e.type = type
    e.context = ctx
    return e
  }
}

/**
 * Create an error with contextual data about it.
 *
 * @remarks
 *
 * This is handy with fp-ts Either<...> because, unlike try-catch, errors are
 * strongly typed with the Either contstruct, making it so the error contextual
 * data flows with inference through your program.
 */
export function exception<Context extends SomeRecord = {}>(
  message: string,
  context?: Context
): BaseException<'generic', Context> {
  const e = new Error(message) as BaseException<'generic', Context>

  Object.defineProperty(e, 'message', {
    enumerable: true,
    value: e.message,
  })

  if (context) {
    e.context = context
  }
  e.type = 'generic'

  return e
}

export type SerializedError = {
  name: string
  message: string
  stack?: string
} & JsonObject

export function serializeError(e: Error): SerializedError {
  return {
    ...e,
    name: e.name,
    message: e.message,
    stack: e.stack,
  }
}

export function deserializeError(se: SerializedError): Error {
  const { name, stack, message, ...rest } = se
  const e =
    name === 'EvalError'
      ? new EvalError(message)
      : name === 'RangeError'
      ? new RangeError(message)
      : name === 'TypeError'
      ? new TypeError(message)
      : name === 'URIError'
      ? new URIError(message)
      : name === 'SyntaxError'
      ? new SyntaxError(message)
      : name === 'ReferenceError'
      ? new ReferenceError(message)
      : new Error(message)

  Object.defineProperty(e, 'stack', {
    enumerable: false,
    value: stack,
  })

  Object.assign(e, rest)

  return e
}

export function noop() {}

/**
 * This makes the optimally pretty import path following Node's algorithm.
 *
 * @example
 *
 * ```
 * foo -> foo
 * ```
 * ```
 * foo/bar -> foo/bar
 * ```
 * ```
 * foo/bar.js -> foo/bar
 * ```
 * ```
 * foo/bar/index.js -> foo/bar
 * ```
 */
export function prettyImportPath(id: string): string {
  const { dir, name, ext } = Path.parse(id)

  if (name === 'index') return dir

  if (ext) {
    return id.replace(ext, '')
  }

  return id
}

type SomeRecord = Record<string, unknown>

export function httpListen(server: HTTP.Server, options: Net.ListenOptions): Promise<void> {
  return new Promise((res, rej) => {
    server.listen(options, () => {
      res()
    })
  })
}

export function httpClose(server: HTTP.Server): Promise<void> {
  return new Promise((res, rej) => {
    server.close((err) => {
      if (err) {
        rej(err)
      } else {
        res()
      }
    })
  })
}

/**
 * Run require resolve from the given path
 */
export function requireResolveFrom(moduleId: string, fromPath: string): string {
  const resolvedPath = require.resolve(moduleId, {
    paths: (Module as any)._nodeModulePaths(fromPath),
  })

  return slash(resolvedPath)
}

export function indent(str: string, len: number, char: string = ' ') {
  return str
    .split('\n')
    .map((s) => char.repeat(len) + s)
    .join('\n')
}
