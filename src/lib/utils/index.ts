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
