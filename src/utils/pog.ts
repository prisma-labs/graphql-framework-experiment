import * as Debug from 'debug'
import * as Path from 'path'

const doLog = Debug.debug('graphql-santa')

export function pog(
  formatter: unknown,
  ...args: unknown[]
): ReturnType<typeof doLog> {
  return doLog(formatter, ...args)
}

export namespace pog {
  /**
   * Create a debug logger prefixed with graphql-santa log namesapce.
   * The given component name can be a path and the dir path and extension will
   * be automatically stripped. This allows the following pattern from the
   * caller side.
   *
   * @example
   *
   *    const log = sub(__filename)
   *
   * @param component The name of this logger. Can be a file path like `__filename`.
   */
  export const sub = (component: string) => {
    const parsed = Path.parse(component)
    return Debug.debug(`graphql-santa:${parsed.name}`)
  }
}
