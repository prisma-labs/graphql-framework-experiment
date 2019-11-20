import createDebugger from 'debug'
import { parse } from 'path'

const doLog = createDebugger('pumpkins')

export function pog(
  formatter: unknown,
  ...args: unknown[]
): ReturnType<typeof doLog> {
  return doLog(formatter, ...args)
}

export namespace pog {
  /**
   * Create a debug logger prefixed with pumpkins log namesapce.
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
    const parsed = parse(component)
    return createDebugger(`pumpkins:${parsed.name}`)
  }
}
