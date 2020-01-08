import * as Logger from './'
import * as Output from './output'

resetEnvironmentBeforeEachTest()

let logger: Logger.Logger
let output: MockOutput.MockOutput

beforeEach(() => {
  output = MockOutput.create()
  logger = Logger.create({ output })
})

it('in production the default level is "info"', () => {
  process.env.NODE_ENV = 'production'
  expect(Logger.create().level).toEqual('info')
})

it('outside production the default level is "debug"', () => {
  process.env.NODE_ENV = 'not-production'
  expect(Logger.create().level).toEqual('debug')
})

it('has a log method for each log level', () => {
  logger.level = 'trace'
  logger.fatal('hi')
  logger.error('hi')
  logger.warn('hi')
  logger.info('hi')
  logger.debug('hi')
  logger.trace('hi')
  expect(output.writes).toMatchSnapshot()
})

it('log methods accept context', () => {
  logger.info('hi', { user: { id: 1 } })
  expect(output.writes).toMatchSnapshot()
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

  it.todo('does not affect parent logger')
  it.todo('is inherited by child-loggers')
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
    writes: string[]
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
