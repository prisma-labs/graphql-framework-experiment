import * as Logger from '@nexus/logger'

export const log = Logger.create({ name: 'nexus' })

// Convenience explicitly named export for modules that want to import and crate
// child logger right away
export const rootLogger = log
