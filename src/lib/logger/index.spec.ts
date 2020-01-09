import * as Logger from './'
import * as Output from './output'

resetEnvironmentBeforeEachTest()

let logger: Logger.Logger
let output: MockOutput.MockOutput

beforeEach(() => {
  output = MockOutput.create()
  logger = Logger.create({ output })
})

describe('output', () => {
  it('defaults to stdout for all levels', () => {
    const write = process.stdout.write
    ;(process.stdout.write as any) = output.write
    Logger.create().fatal('foo')
    process.stdout.write = write
    expect(output.writes).toMatchSnapshot()
  })
})

describe('level', () => {
  it('defaults to "info" when NODE_ENV=production', () => {
    process.env.NODE_ENV = 'production'
    expect(Logger.create().getLevel()).toEqual('info')
  })

  it('defaults to "debug" when NODE_ENV!=production', () => {
    process.env.NODE_ENV = 'not-production'
    expect(Logger.create().getLevel()).toEqual('debug')
  })

  it('may be configured at construction time', () => {
    expect(Logger.create({ level: 'trace' }).getLevel()).toEqual('trace')
  })

  it('may be configured at instnace time', () => {
    expect(
      Logger.create({ level: 'trace' })
        .setLevel('warn')
        .getLevel()
    ).toEqual('warn')
  })

  it('logs below set level are not output', () => {
    logger.setLevel('warn').info('foo')
    expect(output.writes).toEqual([])
  })
})

describe('pretty', () => {
  it.todo('defualts first to process.env.LOG_ENV, then tty presence')
  it.todo('may be configured at construction time')
  it.todo('may be configured at instance time')
})

describe('.<level> log methods', () => {
  it('accept an event name and optional context', () => {
    logger.info('hi', { user: { id: 1 } })
    logger.info('bye')
    expect(output.writes).toMatchSnapshot()
  })

  it('one for each log level', () => {
    logger.setLevel('trace')
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
    expect(logger.getLevel()).toBe('debug')
    logger
      .setLevel('trace')
      .child('tim')
      .trace('hi')
    // The fact that we get output for trace log from child means it honored the
    // setLevel.
    expect(output.writes).toMatchSnapshot()
  })

  it('reacts to level changes in root logger', () => {
    const b = logger.child('b')
    logger.setLevel('trace')
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
        const log: any = JSON.parse(message)
        log.time = 0
        log.pid = 0
        output.writes.push(log)
      },
    } as MockOutput

    return output
  }
}

/**
 * Reset the environment before each test, allowing each test to modify it to
 * its needs.
 */
function resetEnvironmentBeforeEachTest() {
  const originalEnvironment = Object.assign({}, process.env)
  beforeEach(() => {
    process.env = Object.assign({}, originalEnvironment)
  })
}
