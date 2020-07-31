import { log } from '@nexus/logger'
import * as GraphQL from 'graphql'
import * as HTTP from 'http'
import 'jest-extended'
import * as Lo from 'lodash'
import { inspect } from 'util'
import { setReflectionStage, unsetReflectionStage } from '../lib/reflection'
import * as App from './app'
import * as Lifecycle from './lifecycle'

let app: App.PrivateApp

function dump(x: any) {
  return inspect(x, { depth: null })
}

beforeEach(() => {
  app = App.create() as App.PrivateApp
  // fix once there is a singleton logger
  log.settings({ pretty: { timeDiff: false } })
  app.settings.change({ logger: { pretty: { color: false, timeDiff: false } } })
})

describe('reset', () => {
  it('reset the app state', () => {
    const originalAppState = Lo.cloneDeep(app.private.state)
    app.settings.change({
      server: { path: '/bar' },
      schema: { connections: { foo: {} } },
    })
    app.schema.objectType({
      name: 'Foo',
      definition(t) {
        t.string('ok')
      },
    })
    app.on.start(() => {})
    app.assemble()
    app.reset()
    expect(app.settings.current.server.path).toEqual(app.settings.original.server.path)
    expect(app.settings.current.schema).toEqual(app.settings.original.schema)
    // must dump because functions are not equal-able
    expect(dump(app.private.state)).toEqual(dump(originalAppState))
    expect(app.private.state.components.lifecycle).toEqual(Lifecycle.createLazyState())
  })

  it('calling before assemble is fine', () => {
    app.reset()
  })

  it('multiple calls is effectively a noop', () => {
    app.reset()
    app.reset()
  })
})

describe('assemble', () => {
  const spy = createLogSpy()

  beforeEach(() => {
    // avoid schema check error
    app.schema.objectType({
      name: 'Foo',
      definition(t) {
        t.string('ok')
      },
    })
  })

  it('multiple calls is a noop', () => {
    app.assemble()
    app.assemble()
  })

  describe('warnings when api features used after assembly', () => {
    it('settings.change', () => {
      app.assemble()
      app.settings.change({ server: { path: '/foo' } })
      expect(spy.log.mock.calls).toMatchSnapshot()
    })

    it('schema.use', () => {
      app.assemble()
      app.schema.use({ config: { name: 'foo' } })
      expect(spy.log.mock.calls).toMatchSnapshot()
    })

    // todo all api methods
  })
})

describe('lifecycle', () => {
  beforeEach(() => {
    app.settings.change({ server: { port: 7583 } })
    app.schema.queryType({
      definition(t) {
        t.string('foo')
      },
    })
  })
  afterEach(async () => {
    await app.stop()
  })
  describe('start', () => {
    it('callback is called with data when app is started', async () => {
      const fn = jest.fn()
      app.on.start(fn)
      app.assemble()
      await app.start()
      expect(fn.mock.calls[0][0].schema instanceof GraphQL.GraphQLSchema).toBeTrue()
    })
    it('if callback throws error then Nexus shows a nice error', async () => {
      app.on.start(() => {
        throw new Error('error from user code')
      })
      app.assemble()
      expect(await app.start().catch((e: Error) => e)).toMatchInlineSnapshot(`
        [Error: Lifecycle callback error on event "start":

        error from user code]
      `)
    })
  })
})

describe('checks', () => {
  const spy = createLogSpy()

  it('if graphql schema is empty upon assemble then there is a warning', () => {
    app.assemble()
    expect(spy.log.mock.calls).toMatchInlineSnapshot(`
      Array [
        Array [
          "▲ nexus:schema Your GraphQL schema is empty. This is normal if you have not defined any GraphQL types yet. If you did however, check that your files are contained in the same directory specified in the \`rootDir\` property of your tsconfig.json file.
      ",
        ],
      ]
    `)
  })
})

describe('server', () => {
  it('has raw.http to get access to underling node http server', () => {
    expect(app.server.raw.http).toBeInstanceOf(HTTP.Server)
  })

  describe('handlers', () => {
    it('under reflection are noops', () => {
      setReflectionStage('plugin')
      const g = app.server.handlers.graphql as any
      expect(g()).toBeUndefined()
      unsetReflectionStage()
    })

    // todo, process exit poop
    it.todo('if accessed before assembly, and not under reflection, error')
  })
})

/**
 * helpers
 */

function createLogSpy() {
  const spy = {} as { log: jest.SpyInstance }

  beforeEach(() => {
    spy.log = jest.spyOn(process.stdout, 'write').mockImplementation(() => {
      return true
    })
  })

  afterEach(() => {
    spy.log.mockRestore()
  })

  return spy
}
