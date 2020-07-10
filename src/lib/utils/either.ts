import { Either, isLeft, isRight } from 'fp-ts/lib/Either'
import { inspect } from 'util'
import { fatal } from '../process'

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
 * Extract the left value from an Either or throw.
 */
export function leftOrThrow<A, B>(x: Either<A, B>): A {
  if (isLeft(x)) return x.left
  throw new Error(`Unexpected Either.right:\n${inspect(x.right)}`)
}

/**
 * Extract the right value from an Either or throw.
 */
export function rightOrFatal<A extends Error, B>(x: Either<A, B>): B {
  if (isLeft(x)) fatal(x.left)
  return x.right
}
