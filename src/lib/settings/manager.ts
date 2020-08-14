import * as Logger from '@nexus/logger'
import * as Lo from 'lodash'
import { DataDefault, MetadataState, Spec } from '.'
import { PlainObject } from '../utils'
import { commit, dataFromMetadata, FixupInfo, initialize, resolve } from './settings'
import { isDevelopment } from './utils'
import { validateSpecifier } from './validate-spec'

const log = Logger.log.child('settings')

/**
 * todo
 */
export type Manager<Input extends PlainObject, Data extends PlainObject> = {
  reset(): Manager<Input, Data>
  change(input: Input): Manager<Input, Data>
  original(): Data
  metadata: MetadataState<Data>
  data: Data
}

// todo errors currently report names of setting fields, but not the namespaces
// to it (if any)
// todo should onFixup be replaced with a batch version of onfixups that gets
// called with all fixups that happened for all of the input?
// todo allow env vars to populate settings
// todo track env var as value source
// todo $initial magic var to reset settting to its original state, re-running
// dynamic initializers if necessary
// todo run initial through fixup in dev to be safer
// todo run initial through validation in dev to be safer

export type Options = {
  /**
   * Handle fixup events.
   *
   * If your settings spec has no fixups then you can ignore this option.
   *
   * By default, fixups are logged at warning level. If you provide your own
   * function then this default behaviour will be disabled. You can retain it by
   * calling the default function passed as a second argument to your function.
   */
  onFixup?: (info: FixupInfo, originalHandler: (info: FixupInfo) => void) => void
}

/**
 *
 */
export function create<Input extends PlainObject, Data extends PlainObject = DataDefault<Input>>({
  fields,
  ...options
}: {
  fields: Spec<Input, Data>
} & Options): Manager<Input, Data> {
  log.debug('construct')
  if (isDevelopment()) {
    validateSpecifier({ fields }, { path: '__root__' })
  }

  // todo we currently have to clone the given spec deeply because mapEntryData mutations the spec with shadow specifiers
  // and shodow specifiers currently break the second+ initialize run (e.g. during reset)
  // todo we didn't catch this yet with own unit test, but other nexus unit tets caught the issue

  const initial = initialize({ fields: Lo.cloneDeep(fields) }, { path: '__root__' })
  const state = {
    data: initial.data as Data,
    original: (undefined as any) as Data, // lazy
    metadata: initial.metadata as any, // Metadata<Data>,
  }

  const api: Manager<Input, Data> = {
    data: state.data,
    metadata: state.metadata,
    change(input) {
      log.debug('change', { input })
      const newData = resolve(options, 'set', { fields }, input, state.data, state.metadata)
      commit({ fields: Lo.cloneDeep(fields) }, 'set', newData, state.data, state.metadata)
      return api
    },
    reset() {
      log.debug('reset')
      const initial = initialize({ fields: Lo.cloneDeep(fields) }, { path: '__root__' })
      api.data = state.data = initial.data as any
      api.metadata = state.metadata = initial.metadata as any
      return api
    },
    original() {
      log.debug('get original')
      const original = state.original ?? dataFromMetadata(state.metadata, {})
      return original
    },
  }

  return api
}
