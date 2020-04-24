export type MaybePromise<T = void> = T | Promise<T>

export type CallbackRegistrer<F> = (f: F) => void

export type SideEffector = () => MaybePromise

export type Param1<F> = F extends (p: infer P, ...args: any[]) => any ? P : never

/**
 * DeepPartial
 * @desc Partial that works for deeply nested structure
 * @example
 *   // Expect: {
 *   //   first?: {
 *   //     second?: {
 *   //       name?: string;
 *   //     };
 *   //   };
 *   // }
 *   type NestedProps = {
 *     first: {
 *       second: {
 *         name: string;
 *       };
 *     };
 *   };
 *   type PartialNestedProps = DeepPartial<NestedProps>;
 */
export declare type DeepPartial<T> = T extends Function
  ? T
  : T extends Array<infer U>
  ? DeepPartialArray<U>
  : T extends object
  ? DeepPartialObject<T>
  : T | undefined
/** @private */
export interface DeepPartialArray<T> extends Array<DeepPartial<T>> {}
/** @private */
export declare type DeepPartialObject<T> = {
  [P in keyof T]?: DeepPartial<T[P]>
}

/**
 * DeepRequired
 * @desc Required that works for deeply nested structure
 * @example
 *   // Expect: {
 *   //   first: {
 *   //     second: {
 *   //       name: string;
 *   //     };
 *   //   };
 *   // }
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
/** @private */
export interface DeepRequiredArray<T> extends Array<DeepRequired<NonUndefined<T>>> {}
/** @private */
export declare type DeepRequiredObject<T> = {
  [P in keyof T]-?: DeepRequired<NonUndefined<T[P]>>
}
export declare type NonUndefined<A> = A extends undefined ? never : A

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

import * as Path from 'path'
import Git from 'simple-git/promise'

export type OmitFirstArg<Func> = Func extends (firstArg: any, ...args: infer Args) => infer Ret
  ? (...args: Args) => Ret
  : never

const createCodeNameGenerator = require('codename')

/**
 * Generate a random project name.
 */
export function generateProjectName(): string {
  return createCodeNameGenerator()
    .generate(['alliterative', 'random'], ['adjectives', 'animals'])
    .map((word: string | number) => String(word).replace(' ', '-').toLowerCase())
    .join('-')
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

// todo extends Json
export function repalceInObject<C extends object>(
  dynamicPattern: string | RegExp,
  replacement: string,
  content: C
): C {
  return JSON.parse(JSON.stringify(content).split(dynamicPattern).join(replacement))
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
