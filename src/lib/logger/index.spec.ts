import * as Lo from 'lodash'
import * as Logger from './'
import * as Output from './output'

resetBeforeEachTest(process, 'env')
resetBeforeEachTest(process.stdout, 'isTTY')
resetBeforeEachTest(console, 'log')

let logger: Logger.RootLogger
let output: MockOutput.MockOutput

beforeEach(() => {
  process.env.LOG_PRETTY = 'false'
  output = MockOutput.create()
  logger = Logger.create({ output })
})

describe('name', () => {
  it('becomes the first entry in path', () => {
    Logger.create({ output, name: 'foo' }).info('bar')
    expect(output.writes[0].path).toEqual(['foo'])
  })
  it('defaults to "root"', () => {
    logger.info('bar')
    expect(output.writes[0].path).toEqual(['root'])
  })
})

describe('settings', () => {
  describe('pretty', () => {
    describe('.enabled', () => {
      it('can be disabled', () => {
        expect(
          Logger.create({ pretty: { enabled: false } }).settings.pretty.enabled
        ).toEqual(false)
      })
      it('persists across peer field changes', () => {
        const l = Logger.create({ pretty: { enabled: false } })
        l.settings({ pretty: { color: false } })
        expect(l.settings.pretty).toEqual({
          enabled: false,
          color: false,
          levelLabel: false,
        })
      })
      it('controls if logs are rendered pretty or as JSON', () => {
        logger.info('foo')
        logger.settings({ pretty: true })
        logger.settings({ pretty: true, level: 'trace' })
        logger.fatal('foo', { lib: /see/ })
        logger.error('foo', { har: { mar: 'tek' } })
        logger.warn('foo', { bleep: [1, '2', true] })
        logger.info('foo', { qux: true })
        logger.debug('foo', { foo: 'bar' })
        logger.trace('foo', { a: 1, b: 2, c: 'three' })
        expect(output.writes).toMatchSnapshot()
      })
      describe('precedence', () => {
        it('considers instnace time config first', () => {
          process.stdout.isTTY = false
          process.env.LOG_PRETTY = 'false'
          const l = Logger.create({ pretty: false })
          l.settings({ pretty: true })
          expect(l.settings.pretty.enabled).toEqual(true)
        })
        it('then considers contruction time config', () => {
          process.stdout.isTTY = false
          process.env.LOG_PRETTY = 'false'
          const l = Logger.create({ pretty: true })
          expect(l.settings.pretty.enabled).toEqual(true)
        })
        it('then considers LOG_PRETTY env var true|false (case insensitive)', () => {
          process.stdout.isTTY = false
          process.env.LOG_PRETTY = 'tRuE'
          const l = Logger.create()
          expect(l.settings.pretty.enabled).toEqual(true)
        })
        it('then defaults to process.stdout.isTTY', () => {
          delete process.env.LOG_PRETTY // pre-test logic forces false otherwise
          process.stdout.isTTY = true
          const l = Logger.create()
          expect(l.settings.pretty.enabled).toEqual(true)
        })
      })
    })

    describe('.color', () => {
      it('controls if pretty logs have color or not', () => {
        logger.settings({ pretty: { enabled: true, color: false } })
        logger.info('foo', { qux: true })
        expect(output.writes).toMatchSnapshot()
      })
      it('can be disabled', () => {
        expect(
          Logger.create({ pretty: { enabled: false, color: false } }).settings
            .pretty.color
        ).toEqual(false)
      })
      it('is true by default', () => {
        expect(
          Logger.create({ pretty: { enabled: true } }).settings.pretty
        ).toEqual({
          enabled: true,
          color: true,
          levelLabel: false,
        })
        expect(
          Logger.create({ pretty: { enabled: false } }).settings.pretty
        ).toEqual({
          enabled: false,
          color: true,
          levelLabel: false,
        })
      })
      it('persists across peer field changes', () => {
        const l = Logger.create({
          pretty: { enabled: false, color: false },
        })
        l.settings({ pretty: { enabled: true } })
        expect(l.settings.pretty).toEqual({
          enabled: true,
          color: false,
          levelLabel: false,
        })
      })
    })
    describe('.levelLabel', () => {
      it('is false by default', () => {
        expect(Logger.create().settings.pretty.levelLabel).toEqual(false)
      })
      it('can be enabled', () => {
        expect(
          Logger.create({ pretty: { levelLabel: true } }).settings.pretty
            .levelLabel
        ).toEqual(true)
        expect(
          Logger.create().settings({ pretty: { levelLabel: true } }).settings
            .pretty.levelLabel
        ).toEqual(true)
      })
      it('persists across peer field changes', () => {
        const l = Logger.create({ pretty: { levelLabel: true } })
        l.settings({ pretty: false })
        expect(l.settings.pretty.levelLabel).toBe(true)
      })
      it('controls if label is spelt out or not', () => {
        logger.settings({
          pretty: { enabled: true, levelLabel: true, color: false },
        })
        logger.fatal('foo')
        logger.error('foo')
        logger.warn('foo')
        logger.info('foo')
        logger.debug('foo')
        logger.trace('foo')
        expect(output.writes).toMatchSnapshot()
      })
    })

    describe('shorthands', () => {
      it('true means enabled true', () => {
        expect(Logger.create({ pretty: true }).settings.pretty).toEqual({
          enabled: true,
          color: true,
          levelLabel: false,
        })
      })

      it('false means enabled false', () => {
        expect(Logger.create({ pretty: false }).settings.pretty).toEqual({
          enabled: false,
          color: true,
          levelLabel: false,
        })
      })
    })
  })
})

describe('demo', () => {
  it('runs a demo', () => {
    console.log = output.write
    logger.settings({ pretty: { enabled: true, color: false } })
    Logger.demo(logger)
    expect(output.writes).toMatchSnapshot()
  })
  it.todo('runs automatically when LOG_DEMO=true')
})

describe('output', () => {
  it('defaults to stdout for all levels', () => {
    const write = process.stdout.write
    ;(process.stdout.write as any) = output.write
    Logger.create({ pretty: false }).fatal('foo')
    process.stdout.write = write
    expect(output.writes).toMatchSnapshot()
  })
})

describe('level', () => {
  describe('precedence', () => {
    it('considers instance time config first', () => {
      process.env.NODE_ENV = 'production'
      process.env.LOG_LEVEL = 'fatal'
      const logger = Logger.create({ level: 'fatal' })
      logger.settings({ level: 'trace' })
      expect(logger.settings.level).toEqual('trace')
    })

    it('then considers construction time config', () => {
      process.env.NODE_ENV = 'production'
      process.env.LOG_LEVEL = 'fatal'
      const logger = Logger.create({ level: 'trace' })
      expect(logger.settings.level).toEqual('trace')
    })

    it('then considers LOG_LEVEL env var', () => {
      process.env.NODE_ENV = 'production'
      process.env.LOG_LEVEL = 'trace'
      const logger = Logger.create()
      expect(logger.settings.level).toEqual('trace')
    })

    it('then considers NODE_ENV=production', () => {
      process.env.NODE_ENV = 'production'
      const logger = Logger.create()
      console.log(process.env.LOG_LEVEL)
      expect(logger.settings.level).toEqual('info')
    })

    it('then defaults to debug', () => {
      const logger = Logger.create()
      expect(logger.settings.level).toEqual('debug')
    })
  })

  it('logs below set level are not output', () => {
    logger.settings({ level: 'warn' }).info('foo')
    expect(output.writes).toEqual([])
  })

  it('LOG_LEVEL env var config is treated case insensitive', () => {
    process.env.NODE_ENV = 'production'
    process.env.LOG_LEVEL = 'TRACE'
    const logger = Logger.create()
    expect(logger.settings.level).toEqual('trace')
  })

  it('LOG_LEVEL env var config when invalid triggers thrown readable error', () => {
    process.env.LOG_LEVEL = 'ttrace'
    expect(() => Logger.create()).toThrowErrorMatchingInlineSnapshot(
      `"Could not parse environment variable LOG_LEVEL into LogLevel. The environment variable was: ttrace. A valid environment variable must be like: fatal, error, warn, info, debug, trace"`
    )
  })
})

describe('.<level> log methods', () => {
  it('accept an event name and optional context', () => {
    logger.info('hi', { user: { id: 1 } })
    logger.info('bye')
    expect(output.writes).toMatchSnapshot()
  })

  it('one for each log level', () => {
    logger.settings({ level: 'trace' })
    logger.fatal('hi')
    logger.error('hi')
    logger.warn('hi')
    logger.info('hi')
    logger.debug('hi')
    logger.trace('hi')
    expect(output.writes).toMatchSnapshot()
  })
})

describe('.addToContext', () => {
  it('pins context for all subsequent logs from the logger', () => {
    logger.addToContext({ user: { id: 1 } })
    logger.info('hi')
    expect(output.writes).toMatchSnapshot()
  })

  it('can be called multiple times, merging deeply', () => {
    logger.addToContext({ user: { id: 1 } })
    logger.addToContext({ user: { name: 'Jill' } })
    logger.info('hi')
    expect(output.writes).toMatchSnapshot()
  })

  it('gets deeply merged with local context', () => {
    logger.addToContext({ user: { id: 1 } })
    logger.info('hi', { user: { name: 'Jill' } })
    expect(output.writes).toMatchSnapshot()
  })

  it('local context takes prescedence over pinned context', () => {
    logger.addToContext({ user: { id: 1 } })
    logger.info('hi', { user: { id: 2 } })
    expect(output.writes).toMatchSnapshot()
  })
})

describe('.child', () => {
  it('creates a sub logger', () => {
    logger.child('tim').info('hi')
    expect(output.writes).toMatchSnapshot()
  })

  it('log output includes path field showing the logger namespacing', () => {
    logger
      .child('b')
      .child('c')
      .child('d')
      .info('foo')
    expect(output.writes[0].path).toEqual(['root', 'b', 'c', 'd'])
  })

  it('inherits context from parent', () => {
    logger
      .addToContext({ foo: 'bar' })
      .child('tim')
      .info('hi')
    expect(output.writes[0].context).toEqual({ foo: 'bar' })
  })

  it('at log time reflects the current state of parent context', () => {
    const b = logger.child('b')
    logger.addToContext({ foo: 'bar' })
    b.info('lop')
    expect(output.writes[0].context).toEqual({ foo: 'bar' })
  })

  it('at log time reflects the current state of parent context even from further up the chain', () => {
    const b = logger.child('b')
    const c = b.child('c')
    const d = c.child('d')
    logger.addToContext({ foo: 'bar' })
    d.info('lop')
    expect(output.writes[0].context).toEqual({ foo: 'bar' })
  })

  it('inherits level from parent', () => {
    expect(logger.settings.level).toBe('debug')
    logger
      .settings({ level: 'trace' })
      .child('tim')
      .trace('hi')
    // The fact that we get output for trace log from child means it honored the
    // setLevel.
    expect(output.writes).toMatchSnapshot()
  })

  it('reacts to level changes in root logger', () => {
    const b = logger.child('b')
    logger.settings({ level: 'trace' })
    b.trace('foo')
    // The fact that we get output for trace log from child means it honored the
    // setLevel.
    expect(output.writes).toMatchSnapshot()
  })

  it('is unable to change context of parent', () => {
    logger.child('b').addToContext({ foo: 'bar' })
    logger.info('qux')
    expect(output.writes[0].context).toEqual({})
  })

  it('is unable to change context of siblings', () => {
    const b1 = logger.child('b1').addToContext({ from: 'b1' })
    const b2 = logger.child('b2').addToContext({ from: 'b2' })
    const b3 = logger.child('b3').addToContext({ from: 'b3' })
    logger.addToContext({ foo: 'bar' })
    b1.info('foo')
    b2.info('foo')
    b3.info('foo')
    // All should inherit the root context
    expect(output.writes).toMatchSnapshot()
  })

  it('cannot affect level', () => {
    expect((logger.child('b') as any).setLevel).toBeUndefined()
  })
})

//
// Helpers
//

/**
 * A mock output stream useful for passing to logger and later reflecting on the
 * values that it wrote.
 */
namespace MockOutput {
  export type MockOutput = Output.Output & {
    writes: Record<string, any>[]
  }

  export function create(): MockOutput {
    const output = {
      writes: [],
      write(message: string) {
        let log: any
        try {
          log = JSON.parse(message)
          log.time = 0
          log.pid = 0
        } catch (e) {
          if (e instanceof SyntaxError) {
            // assume pretty mode is on
            log = message
          }
        }
        output.writes.push(log)
      },
    } as MockOutput

    return output
  }
}

/**
 * Restore the key on given object before each test. Useful for permiting tests
 * to modify the environment and so on.
 */
function resetBeforeEachTest(object: any, key: string) {
  const orig = object[key]
  beforeEach(() => {
    if (typeof orig === 'object') {
      object[key] = Lo.cloneDeep(orig)
    } else {
      object[key] = orig
    }
  })
}
