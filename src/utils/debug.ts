import createLogger from 'debug'

type Debugger = ReturnType<typeof createLogger>

export function debug(component: string): Debugger {
  return createLogger(`pumpkins:${component}`)
}

export namespace debug {
  export const app: Debugger = createLogger('pumpkins:app')
  export const schema: Debugger = createLogger('pumpkins:schema')
  export const prisma: Debugger = createLogger('pumpkins:prisma')
}
