import * as RootLogger from './root-logger'

export function demo() {
  console.log()
  console.log('-----------')
  console.log('LOGGER DEMO')
  console.log('-----------')
  const logger = RootLogger.create()
  const origLevel = logger.settings.level
  logger.settings({ level: 'trace' })
  logger.fatal('foo', { lib: /see/ })
  logger.error('foo', { har: { mar: 'tek' } })
  logger.warn('foo', { bleep: [1, '2', true] })
  logger.info('foo')
  logger.debug('foo', { foo: 'bar' })
  logger.trace('foo', { a: 1, b: 2, c: 'three' })
  logger.settings({ level: origLevel })
  console.log('-----------')
  console.log()
}

if (process.env.LOG_DEMO) {
  demo()
}
