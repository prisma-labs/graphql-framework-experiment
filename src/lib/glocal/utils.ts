import { Either, isLeft, isRight } from 'fp-ts/lib/Either'
import * as Path from 'path'
import { findFileRecurisvelyUpwardSync } from '../fs'
import { fatal } from '../process'

/**
 * Handoff execution from a global to local version of a package.
 *
 * If the givne global module path is not a real node package (defined as being
 * unable to locate its package.json file) then an error will be thrown.
 */
export function globalToLocalModule(input: { localPackageDir: string; globalPackageFilename: string }) {
  const globalProjectDir = findFileRecurisvelyUpwardSync('package.json', {
    cwd: Path.dirname(input.globalPackageFilename),
  })?.dir

  if (!globalProjectDir) {
    throw new Error(
      `Could not perform handoff to local package version becuase the given global package does not appear to actually be a package:\n\n${input.globalPackageFilename}`
    )
  }

  require(Path.join(input.localPackageDir, Path.relative(globalProjectDir, input.globalPackageFilename)))
}

/**
 * Extract the left value from an Either.
 */
export function getLeft<A, B>(e: Either<A, B>): A | undefined {
  if (isLeft(e)) return e.left
  return undefined
}

/**
 * Extract the right value from an Either.
 */
export function getRight<A, B>(e: Either<A, B>): B | undefined {
  if (isRight(e)) return e.right
  return undefined
}

/**
 * Extract the right value from an Either or throw.
 */
export function rightOrThrow<A extends Error, B>(x: Either<A, B>): B {
  if (isLeft(x)) throw x.left
  return x.right
}

/**
 * Extract the right value from an Either or throw.
 */
export function rightOrFatal<A extends Error, B>(x: Either<A, B>): B {
  if (isLeft(x)) fatal(x.left)
  return x.right
}
