export type MaybePromise<T = void> = T | Promise<T>

export type CallbackRegistrer<F> = (f: F) => void

export type SideEffector = () => MaybePromise

export type Param1<F> = F extends (p: infer P, ...args: any[]) => any
  ? P
  : never

export type DeepPartial<T extends Record<string, any>> = {
  [P in keyof T]?: T[P] extends Record<string, any> ? DeepPartial<T[P]> : T[P]
} & { [x: string]: any }

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
  return range(num)
    .map(constant(char))
    .join('')
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
  return function() {
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

export type OmitFirstArg<Func> = Func extends (
  firstArg: any,
  ...args: infer Args
) => infer Ret
  ? (...args: Args) => Ret
  : never

const createCodeNameGenerator = require('codename')

/**
 * Generate a random project name.
 */
export function generateProjectName(): string {
  return createCodeNameGenerator()
    .generate(['alliterative', 'random'], ['adjectives', 'animals'])
    .map((word: string | number) =>
      String(word)
        .replace(' ', '-')
        .toLowerCase()
    )
    .join('-')
}

/**
 * Get the name of the CWD or if at disk root and thus making it impossible to
 * extract a meaningful name, generate one.
 */
export function CWDProjectNameOrGenerate(
  opts: { cwd: string } = { cwd: process.cwd() }
): string {
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
 * A wrapper around require. It does nothing special except when LINK env var is
 * set in which case it prefixes the import path with CWD. This is essential
 * when dealing with plugin or plugin-like situations.
 *
 * In prisma case, Prisma Client is generated into user's project and required by other packages in
 * user's prject. Problem is when those "other packages" are LINKED, then their
 * attempts to import fail because they are looking relative to their location
 * on disk, not hte user's project, where they just LINKED into.
 */
export function linkableRequire(id: string): any {
  if (process.env.LINK) {
    return require(Path.join(process.cwd(), 'node_modules', id))
  } else {
    return require(id)
  }
}

export function linkableResolve(id: string): any {
  if (process.env.LINK) {
    return require.resolve(Path.join(process.cwd(), 'node_modules', id))
  } else {
    return require.resolve(id)
  }
}
