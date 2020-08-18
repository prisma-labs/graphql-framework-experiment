import { plugin } from '@nexus/schema'
import { AppState, createAppState } from '../app'
import { create, SchemaInternal } from './schema'

let schema: SchemaInternal
let appState: AppState

beforeEach(() => {
  appState = createAppState()
  schema = create(appState)
})

describe('use', () => {
  it('incrementally adds plugins', () => {
    schema.public.use(plugin({ name: 'foo' }))
    schema.public.use(plugin({ name: 'bar' }))
    expect(appState.components.schema.plugins.length).toEqual(2)
  })
})
