import * as Logger from '../lib/logger'

export const logger = Logger.create({ name: 'nexus-future' })

// Convenience explicitly named export for modules that want to import and crate
// child logger right away
export const rootLogger = logger
