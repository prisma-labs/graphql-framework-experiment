import * as RootLogger from './root-logger'

export function demo(logger?: RootLogger.RootLogger) {
  console.log('')
  console.log('-----------')
  console.log('LOGGER DEMO')
  console.log('-----------')
  logger = logger ?? RootLogger.create()
  const origLevel = logger.settings.level
  logger.settings({ level: 'trace', pretty: true })
  logger.fatal('foo', { lib: /see/ })
  logger.error('foo', {
    har: { mar: 'tek' },
    jar: [1, 2, 3, 4, 4, 5, 6, 6, 7, 9, 1, 2, 4, 5, 6, 7, 3, 6, 5, 4],
    kio: Object.create(null, { [Symbol.toStringTag]: { value: 'foo' } }),
  })
  logger.warn('foo', { bleep: [1, '2', true] })
  logger.info('foo')
  logger.debug('foo', {
    results: [
      {
        userId: 1,
        id: 1,
        title: 'delectus aut autem',
        completed: false,
      },
      {
        userId: 1,
        id: 2,
        title: 'quis ut nam facilis et officia qui',
        completed: false,
      },
      {
        userId: 1,
        id: 3,
        title: 'fugiat veniam minus',
        completed: false,
      },
      {
        userId: 1,
        id: 4,
        title: 'et porro tempora',
        completed: true,
      },
      {
        userId: 1,
        id: 5,
        title:
          'laboriosam mollitia et enim quasi adipisci quia provident illum',
        completed: false,
      },
    ],
    tri: 'wiz',
    on: false,
  })
  logger.debug('foo', { foo: 'bar' })
  logger.trace('foo', { a: 1, b: 2, c: 'three' })
  logger.settings({ level: origLevel })
  console.log('-----------')
  console.log('')
}

if (process.env.LOG_DEMO) {
  demo()
}
