process.env.FORCE_COLOR = '0'

import { log } from '@nexus/logger'
import * as Lo from 'lodash'
import { removeReflectionStage, setReflectionStage } from '../lib/reflection'
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

describe('server handlers', () => {
  it('under reflection are noops', () => {
    setReflectionStage('plugin')
    const g = app.server.handlers.graphql as any
    const p = app.server.handlers.playground as any
    expect(g()).toBeUndefined()
    expect(p()).toBeUndefined()
    removeReflectionStage()
  })

  // todo, process exit poop
  it.todo('if accessed before assembly, and not under reflection, error')
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
