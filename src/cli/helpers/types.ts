/**
 * Command interface
 */
export interface Command {
  parse(argv: string[]): Promise<void | string | Error>
}

/**
 * Commands. An object where keys represent command names. Values are command
 * implementations. The structure is recursive, allowing for nested
 * sub-commands. String values are allowed as references to other commands at
 * the same level.
 *
 * @example
 *  {
 *    a: new ACommand(),
 *    b: 'a'
 *  }
 *
 *  $ some-cli a
 *  $ some-cli b # invokes 'a'
 *
 * @example
 *
 *  {
 *    a: new ACommand(),
 *    b: {
 *      __default: 'b2',
 *      b1: new B1Command(),
 *      b2: new B2Command(),
 *      b3: {
 *        b31: new FooB31Command(),
 *        b32: new FooB32Command(),
 *      }
 *    }
 *  }
 *
 *  $ some-cli a
 *  $ some-cli b            # runs `b2` because __default set so
 *  $ some-cli b b1
 *  $ some-cli b b2
 *  $ some-cli b b3         # error, no default set
 *  $ some-cli b b3 b31
 *  $ some-cli b b3 b32
 *
 */
export type Commands = {
  // TODO how?
  // __default?: Command | string
  [name: string]: Command | Commands | string
}

export type Dictionary<T> = {
  [key: string]: T
}
