import * as Logger from '@nexus/logger'

export const log = Logger.log.settings({ pretty: { timeDiff: false } }).child('nexus')

// Convenience explicitly named export for modules that want to import and crate
// child logger right away
export const rootLogger = log
