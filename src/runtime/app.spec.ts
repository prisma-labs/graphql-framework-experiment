import { log } from '@nexus/logger'
import * as HTTP from 'http'
import * as Lo from 'lodash'
import { setReflectionStage, unsetReflectionStage } from '../lib/reflection'
import * as App from './app'

let app: App.PrivateApp

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
    app.schema.objectType({ name: 'Foo', definition() {} })
    app.assemble()
    app.reset()
    expect(app.settings.current.server.path).toEqual(app.settings.original.server.path)
    expect(app.settings.current.schema).toEqual(app.settings.original.schema)
    expect(app.private.state).toEqual(originalAppState)
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
    app.schema.objectType({ name: 'Foo', definition() {} })
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
  describe('runtime', () => {
    it('.now is true if not under reflection', () => {
      expect(app.on.runtime.now).toBe(true)
    })
    it('.now is false if under reflection', () => {
      setReflectionStage('plugin')
      expect(App.create().on.runtime.now).toBe(false)
      unsetReflectionStage()
    })
    it('callback is called when app is assmebled', () => {
      const fn = jest.fn()
      app.on.runtime(fn)
      app.assemble()
      expect(fn.mock.calls).toMatchInlineSnapshot(`
      Array [
        Array [],
      ]
    `)
    })
    it('if callback throws error then Nexus shows a nice error', () => {
      app.on.runtime(() => {
        throw new Error('error from user code')
      })
      expect(app.assemble).toThrowErrorMatchingInlineSnapshot(`
        "Lifecycle callback error on event \\"runtime.start.before\\":

        error from user code"
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
      const p = app.server.handlers.playground as any
      expect(g()).toBeUndefined()
      expect(p()).toBeUndefined()
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
