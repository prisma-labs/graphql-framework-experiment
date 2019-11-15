import createLogger from 'debug'

export function log(
  formatter: unknown,
  ...args: unknown[]
): ReturnType<typeof doLog> {
  return doLog(formatter, ...args)
}

const doLog = createLogger('pumpkins')

export namespace log {
  export const create = (component: string) => {
    return createLogger(`pumpkins:${component}`)
  }
  export const app = createLogger('pumpkins:app')
  export const schema = createLogger('pumpkins:schema')
}
