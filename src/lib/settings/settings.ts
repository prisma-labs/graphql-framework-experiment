import ono from '@jsdevtools/ono'
import * as Logger from '@nexus/logger'
import * as Lo from 'lodash'
import { inspect } from 'util'
import { IsRecord, PlainObject } from '../utils'
import { DataDefault, Spec } from './static'

const log = Logger.log.child('settings')

type MetadataValueFromType = 'set' | 'initial'

/**
 * todo
 */
export type Metadata<Data extends PlainObject> = {
  [Key in keyof Data]: IsRecord<Data[Key]> extends true // @ts-ignore-error
    ? MetadataRecord<Metadata<Data[Key][string]>>
    : Data[Key] extends PlainObject
    ? MetadataNamespace<Data[Key]>
    : MetadataLeaf<Data[Key]>
}

type MetadataLeaf<V = any> = {
  type: 'leaf'
  value: V
  initial: V
  from: MetadataValueFromType
}

type MetadataRecord<V = any> = {
  type: 'record'
  from: MetadataValueFromType
  value: Record<string, V>
  initial: Record<string, V>
}

type MetadataNamespace<V = any> = {
  type: 'namespace'
  fields: Record<string, MetadataLeaf<V> | MetadataRecord<V> | MetadataNamespace<V>>
}

type MetadataEntry = Record<string, MetadataLeaf | MetadataNamespace | MetadataRecord>

type AnyMetadata = MetadataEntry | MetadataNamespace | MetadataRecord
type AnyMetadata2<V = any> = MetadataLeaf<V> | MetadataRecord<V> | MetadataNamespace<V>

// type MetadataKind =

/**
 * todo
 */
export type Manager<Input extends PlainObject, Data extends PlainObject> = {
  reset(): Manager<Input, Data>
  change(input: Input): Manager<Input, Data>
  original(): Data
  metadata: Metadata<Data>
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

export type FixupInfo = {
  name: string
  before: unknown
  after: unknown
  messages: string[]
}

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
  // todo guess we cannot use this because we need thrown error to change
  // control flow.
  // export type ViolationInfo = { name: string; messages: string[] }
  // /**
  //  * Get called back when a validator fails.
  //  *
  //  * If your settings spec has no valididators then you can ignore this option.
  //  *
  //  * By default, violations are logged at error level. If you provide
  //  * your own function then this default behaviour will be disabled. You can
  //  * retain it by calling the default function passed as a second argument to
  //  * your function.
  //  */
  // onViolation?: (info: ViolationInfo, originalHandler: (info: ViolationInfo) => void) => void
}

/**
 * Default onFixup handler.
 */
function onFixup(info: FixupInfo): void {
  log.warn(
    'One of your setting values was invalid. We were able to automaticlaly fix it up now but please update your code.',
    info
  )
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
    validateSpec(fields)
  }

  const initial = initialize({ fields }, { path: '__root__' })
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
      const newData = resolve(options, 'set', fields, input, state.data, state.metadata.fields)
      commit(fields, 'set', newData, state.data, state.metadata.fields)
      return api
    },
    reset() {
      log.debug('reset')
      const initial = initialize({ fields }, { path: '__root__' })
      api.data = state.data = initial.data as any
      api.metadata = state.metadata = initial.metadata as any
      return api
    },
    original() {
      log.debug('get original')
      const original = state.original ?? metadataToData(state.metadata, {})
      return original
    },
  }

  return api
}

function metadataToData<Data>(metadata: any, copy: PlainObject): Data {
  Lo.forOwn(metadata.fields, (fieldMetadata, name) => {
    if (fieldMetadata.fields) {
      copy[name] = metadataToData(fieldMetadata, {})
    } else {
      copy[name] = fieldMetadata.initial
    }
  })

  return copy as any
}

function namespaceDataToMetadata(specifier: any, data: any) {
  return Lo.chain(data)
    .entries()
    .reduce((md, [k, v]) => {
      md.fields[k] = dataToMetadata(specifier.fields[k], v)
      return md
    }, createMetadataNamespace())
    .value()
}

function dataToMetadata(specifier: any, data: any): AnyMetadata2 {
  if (isNamespaceSpecifier(specifier)) return namespaceDataToMetadata(specifier, data)
  // todo record
  // if (isRecordSpecifier(specifier)) return ...
  return createMetadataLeaf(data)
}

type TraversalInfo = {
  path: string
}

/**
 * resolvers
 */

/**
 *
 */
function resolveNamespace(
  options: Options,
  metadataFrom: MetadataValueFromType,
  specifier: any,
  inputFieldValue: any,
  info: any,
  data: any,
  metadata: any
) {
  const isValueObject = Lo.isPlainObject(inputFieldValue)

  if (!isValueObject && specifier.fields && !specifier.shorthand) {
    throw new Error(
      `Setting "${
        info.path
      }" is a namespace with no shorthand so expects an object but received a non-object: ${inspect(
        inputFieldValue
      )}`
    )
  }

  let longhandValue = inputFieldValue
  if (!isValueObject && specifier.shorthand) {
    log.debug('expanding shorthand', { info })
    try {
      longhandValue = specifier.shorthand(inputFieldValue)
    } catch (e) {
      throw ono(
        e,
        { info, inputFieldValue },
        `There was an unexpected error while running the namespace shorthand for setting "${
          info.path
        }". The given value was ${inspect(inputFieldValue)}`
      )
    }
  }

  return resolve(options, metadataFrom, specifier.fields, longhandValue, data, metadata.fields)
}

function resolveRecord(
  options: Options,
  metadataFrom: MetadataValueFromType,
  specifier: RecordSpecifier,
  input: any,
  data: any,
  metadata: any
) {
  log.trace('resolve record', { specifier, input, data, metadata })
  const isValueObject = Lo.isPlainObject(input)

  if (!isValueObject) {
    // todo test
    throw new Error('received a non-object for record-type settings')
  }

  let newData = Lo.entries(input).reduce((rec, [entryName, entryValue]) => {
    log.trace('resolve record entry', { entryName, entryValue })

    if (!data[entryName]) {
      log.trace('this is a new record entry, initialize it', { entryName })
      const initial = initialize(specifier.entry, { path: entryName })
      data[entryName] = initial.data
      metadata.value[entryName] = (initial.metadata as any).fields // todo don't assume record-namespace
    }

    rec[entryName] = resolve(
      options,
      metadataFrom,
      specifier.entry.fields, // todo don't assume record-namesapce
      entryValue,
      data[entryName],
      metadata.value[entryName]
    )

    return rec
  }, {} as any)

  if (specifier.mapEntryData) {
    log.trace('running entry data mapper')
    // todo runner wrapper, error handling etc.
    newData = Lo.mapValues(newData, (newEntryData, entryKey) => {
      return specifier.mapEntryData!(newEntryData, entryKey)
    })
  }

  return newData
}

function resolveLeaf(options: Options, specifier: any, value: any, info: TraversalInfo): any {
  let resolvedValue = value

  /**
   * Run fixups
   */
  if (specifier.fixup) {
    let maybeFixedup
    try {
      maybeFixedup = specifier.fixup(resolvedValue)
    } catch (e) {
      throw ono(
        e,
        { info, value: resolvedValue },
        `Fixup for "${info.path}" failed while running on value ${inspect(resolvedValue)}`
      )
    }
    if (maybeFixedup) {
      resolvedValue = maybeFixedup.value
      /**
       * fixup handler
       */
      const fixupInfo = {
        before: value,
        after: maybeFixedup.value,
        name: info.path,
        messages: maybeFixedup.messages,
      }
      if (options.onFixup) {
        try {
          options.onFixup(fixupInfo, onFixup)
        } catch (e) {
          throw ono(e, { info }, `onFixup callback for "${info.path}" failed`)
        }
      } else {
        onFixup(fixupInfo)
      }
    }
  }

  /**
   * Run validators
   */
  if (specifier.validate) {
    let maybeViolation
    try {
      maybeViolation = specifier.validate(resolvedValue)
    } catch (e) {
      // todo use verror or like
      throw ono(
        e,
        { info, value: resolvedValue },
        `Validation for "${info.path}" unexpectedly failed while running on value ${inspect(resolvedValue)}`
      )
    }
    if (maybeViolation) {
      throw new Error(
        `Your setting "${info.path}" failed validation with value ${inspect(
          resolvedValue
        )}:\n\n- ${maybeViolation.messages.join('\n- ')}`
      )
    }
  }

  /**
   * Run type mappers
   */
  resolvedValue = runTypeMapper(specifier, resolvedValue, info)

  return resolvedValue
}

/**
 * Process the given input through the settings spec, resolving its shorthands,
 * fixups, validation and so on until finally assigning it into the setting data.
 * The input is not mutated. The data is.
 */
function resolve(
  options: Options,
  metadataFrom: MetadataValueFromType,
  fields: any,
  input: any,
  data: any,
  metadata: any
) {
  log.trace('resolve', { fields, input, data, metadata })
  const newData: any = Lo.entries(input).reduce((newData, [inputFieldName, inputFieldValue]) => {
    // if no specifier found treat it as a leaf passthrough. This can be useful when wanting to
    // proxy a large number of settings from another system and don't want to have to write out
    // every single property in the tree.
    // Features will be lost by doing this, however
    const specifier = fields[inputFieldName] ?? {}
    const isValueObject = Lo.isPlainObject(inputFieldValue)

    // todo bring this back under strict mode
    // if (!specifier) {
    //   throw new Error(
    //     `You are trying to change a setting called "${inputFieldName}" but no such setting exists`
    //   )
    // }

    if (isValueObject && !isNamespaceSpecifier(specifier) && !isRecordSpecifier(specifier)) {
      throw new Error(
        `Setting "${inputFieldName}" is not a namespace or record and so does not accept objects, but one given: ${inspect(
          inputFieldValue
        )}`
      )
    }

    if (isNamespaceSpecifier(specifier)) {
      newData[inputFieldName] = resolveNamespace(
        options,
        metadataFrom,
        specifier,
        inputFieldValue,
        { path: inputFieldName },
        data[inputFieldName],
        metadata[inputFieldName]
      )
      return newData
    }

    if (isRecordSpecifier(specifier)) {
      newData[inputFieldName] = resolveRecord(
        options,
        metadataFrom,
        specifier,
        inputFieldValue,
        data[inputFieldName],
        metadata[inputFieldName]
      )
      return newData
    }

    if (isLeafSpecifier(specifier)) {
      newData[inputFieldName] = resolveLeaf(options, specifier, inputFieldValue, { path: inputFieldName })
      return newData
    }

    throw new Error(`Unknown kind of specifier: ${inspect(specifier)}`)
  }, {} as any)

  return newData
}

/**
 * commit
 */

/**
 *
 */
function commit(spec: any, metadataFrom: MetadataValueFromType, input: any, data: any, metadata: any) {
  Lo.forOwn(input, (fieldInput, fieldName) => {
    log.trace('committing top level field change', { spec, fieldName, fieldInput, data, metadata })
    doCommit(spec[fieldName], metadataFrom, fieldName, fieldInput, data, metadata)
    log.trace('did commit', { fieldName, fieldInput, data, metadata })
  })
  return data
}

/**
 *
 */
function doCommit(
  specifier: any,
  metadataFrom: MetadataValueFromType,
  key: string,
  input: any,
  parentData: any,
  parentMetadata: AnyMetadata
) {
  // log.trace('commit iteration', { specifier, key, value, parentData, parentMetadata })
  if (isNamespaceSpecifier(specifier)) {
    log.trace('committing namespace', { specifier, key, input, parentData, parentMetadata })
    const mdata = (parentMetadata as any) as Record<string, MetadataNamespace>
    const dataNamespace = parentData[key]
    const mdataNamespace = mdata[key]
    Lo.forOwn(input, (v, k) => {
      doCommit(specifier.fields[k], metadataFrom, k, v, dataNamespace, mdataNamespace.fields as any)
    })
    return
  }

  if (isRecordSpecifier(specifier)) {
    const mdata = (parentMetadata as any) as Record<string, MetadataRecord>
    doCommitRecord(specifier, metadataFrom, input, parentData[key], mdata[key])
    return
  }

  const mdata = parentMetadata as Record<string, MetadataLeaf>

  log.trace('committing leaf', { key, input, parentData, mdata })
  parentData[key] = input
  // todo why can the metadata be undefined?
  if (mdata[key] === undefined) {
    mdata[key] = createMetadataLeaf(input, metadataFrom)
  }
  mdata[key].value = input
  mdata[key].from = metadataFrom
  if (metadataFrom === 'initial') {
    mdata[key].initial = input
  }
}

function doCommitRecord(
  specifier: RecordSpecifier,
  metadataFrom: MetadataValueFromType,
  input: any,
  data: any,
  metadata: MetadataRecord
) {
  log.trace('committing record', { specifier, input, data, metadata })
  Lo.forOwn(input, (recordEntry, recordKey) => {
    // todo assumes record-namespace
    // nothing indicating that these are namespaces, implied, would recurse into leaf otherwise
    Lo.forOwn(recordEntry, (entryValue, entryKey) => {
      data[recordKey] = data[recordKey] ?? {}
      doCommit(
        specifier.entry.fields, // todo don't assume record-namespace
        metadataFrom,
        entryKey,
        entryValue,
        data[recordKey],
        metadata.value[recordKey]
      )
      // todo test
      if (metadataFrom === 'initial') {
        metadata.initial = Lo.cloneDeep(metadata.value)
      }
    })
  })
  log.trace('done committing record', { specifier, input, data, metadata })
}

/**
 * specifiers
 */

/**
 *
 */
function isLeafSpecifier(specifier: any): specifier is LeafSpecifier {
  return !isNamespaceSpecifier(specifier) && !isRecordSpecifier(specifier)
}

type LeafSpecifier = {}

/**
 *
 */
function isRecordSpecifier(specifier: any): specifier is RecordSpecifier {
  return Boolean(specifier.entry)
}

type RecordSpecifier = {
  entry: any
  mapEntryData?(newEntryData: any, entryKey: string): any
}

/**
 *
 */
function isNamespaceSpecifier(specifier: any): specifier is NamespaceSpecifier {
  return Boolean(specifier.fields)
}

type NamespaceSpecifier = {
  fields: any
}

/**
 * initializers
 */

type InitializeResult = { data: PlainObject; metadata: AnyMetadata2 }

/**
 *
 */
function initialize(specifier: any, info: TraversalInfo): InitializeResult {
  if (isNamespaceSpecifier(specifier)) return initializeNamespace(specifier, info)
  if (isRecordSpecifier(specifier)) return initializeRecord(specifier, info)
  if (isLeafSpecifier(specifier)) return initializeLeaf(specifier, info)
  throw new Error('unknown kind of specifier')
}

/**
 *
 */
function initializeLeaf(specifier: any, info: TraversalInfo) {
  log.trace('initialize leaf', { info })
  let value = runInitializer(specifier, info)
  value = runTypeMapper(specifier, value, info)
  return { data: value, metadata: createMetadataLeaf(value) }
}

/**
 *
 */
function initializeNamespace(specifier: any, info: TraversalInfo) {
  log.trace('will initialize namespace', { info, specifier })
  let initializedNamespaceData
  if (specifier.initial) {
    log.trace('will run namespace initializer')
    initializedNamespaceData = specifier.initial()
    log.trace('did run namespace initializer', { initializedNamespaceData })
  } else {
    initializedNamespaceData = {}
  }
  const initializedNamespaceMetadata = namespaceDataToMetadata(specifier, initializedNamespaceData)
  const initializedNamespace = {
    data: initializedNamespaceData,
    metadata: initializedNamespaceMetadata,
  }
  const initializedFieldsResult = Lo.chain(specifier.fields)
    .entries()
    .reduce(
      (acc, [key, specifier]) => {
        const initFieldRes = initialize(specifier, { path: key })
        acc.data[key] = initFieldRes.data
        acc.metadata.fields[key] = initFieldRes.metadata
        return acc
      },
      { metadata: createMetadataNamespace(), data: {} } as any
    )
    .value()
  return {
    data: mergeShallow(initializedNamespace.data, initializedFieldsResult.data),
    metadata: Lo.merge(initializedNamespace.metadata, initializedFieldsResult.metadata),
  }
}

/**
 *
 */
function initializeRecord(specifier: RecordSpecifier, info: TraversalInfo) {
  log.trace('initialize record', { info, specifier })
  // there may be preloaded record entries via the record initializer
  // such entries will be input and thus need to be resolved
  // such entries may also not account for all possible fields of the entry
  // thus we need to run the initializer and seed each entry with that
  // then treat the actual initialzer input as a "change" on that, resolving it

  // get the starter entries (if any)
  const starterEntriesData = runInitializer(specifier, info) ?? {}

  // if no starter entries then no work for us to do, exit early
  if (Lo.isEmpty(starterEntriesData)) {
    const result = { data: {}, metadata: createMetadataRecord({}) }
    log.trace('did initialize record', { specifier, ...result })
    return result
  }

  // get what an initialized entry looks like
  let canonicalEntryResult = Lo.chain(specifier.entry.fields)
    .entries()
    .reduce(
      (acc, [entK, entV]) => {
        const init = initialize(entV, { path: [info.path, '*', entK].join('.') })
        acc.data[entK] = init.data
        acc.metadataRecordValue[entK] = init.metadata
        return acc
      },
      { data: {}, metadataRecordValue: {} } as any
    )
    .value()

  // now stitch the initial record data with the cannonical initialized entry
  let result = Lo.chain(starterEntriesData)
    .keys()
    .reduce(
      (acc, recK) => {
        // if the given initial record data has a value use it, otherwise fall back to the cannonical initialized entry
        acc.data[recK] = acc.data[recK] ?? {}
        acc.metadataRecordValue[recK] = acc.metadataRecordValue[recK] ?? {}
        Lo.forOwn(canonicalEntryResult.data, (entV, entK) => {
          acc.data[recK][entK] = starterEntriesData[recK][entK] ?? entV
          // todo we don't know what kind of metadata that the entry field is, and so we cannot update cannonical with given
          // todo we will need to determin the metadata kind based on the specifier
          acc.metadataRecordValue[recK][entK] = canonicalEntryResult.metadataRecordValue[entK] // 'a' // initialGivenRecordData[recK][entK] ?? entV
          if (starterEntriesData[recK][entK]) {
            if (canonicalEntryResult.metadataRecordValue[entK].type === 'leaf') {
              acc.metadataRecordValue[recK][entK].value = starterEntriesData[recK][entK]
              acc.metadataRecordValue[recK][entK].initial = starterEntriesData[recK][entK]
            }
            // todo if given data present and not leaf (record, namespace) then we need to convert the data into metadata
            // todo only then can we assign into metadata
          }
        })
        return acc
      },
      { data: {}, metadataRecordValue: {} } as any
    )
    .value()

  // stitch together the initialized entry to built up a metadata representation
  result = {
    data: result.data,
    metadata: createMetadataRecord(result.metadataRecordValue),
  }

  if (specifier.mapEntryData) {
    log.trace('running entry data mapper')
    // todo runner wrapper, error handling etc.
    Lo.forOwn(result.data, (newEntryData, entryKey) => {
      const newEntryDataMapped = specifier.mapEntryData!(newEntryData, entryKey)
      doCommitRecord(specifier, 'initial', { [entryKey]: newEntryDataMapped }, result.data, result.metadata)
    })
  }

  log.trace('did initialize record', { result })
  return result
}

/**
 * metadata
 */

/**
 *
 */
function createMetadataLeaf(value: any, from: MetadataValueFromType = 'initial'): MetadataLeaf {
  return { type: 'leaf', from, value, initial: value }
}

/**
 *
 */
function createMetadataRecord(value: any): MetadataRecord {
  return { type: 'record', from: 'initial', value, initial: Lo.cloneDeep(value) }
}

/**
 *
 */
function createMetadataNamespace(): MetadataNamespace {
  return { type: 'namespace', fields: {} }
}

/**
 * runners
 */

/**
 *
 */
function runTypeMapper(specifier: any, inputFieldValue: any, info: TraversalInfo): any {
  if (!specifier.mapType) return inputFieldValue

  log.trace('running type mapper', { info, inputFieldValue })
  try {
    return specifier.mapType(inputFieldValue)
  } catch (e) {
    throw ono(
      e,
      { info },
      `There was an unexpected error while running the type mapper for setting "${info.path}"`
    )
  }
}

/**
 *
 */
function runInitializer(specifier: any, info: TraversalInfo): any {
  if (specifier.initial === undefined) {
    log.trace('no initializer to run', { info })
    return
  }

  if (typeof specifier.initial === 'function') {
    log.trace('running initializer', { info })
    try {
      return specifier.initial()
    } catch (e) {
      throw ono(
        e,
        { info },
        `There was an unexpected error while running the initializer for setting "${info.path}"`
      )
    }
  }

  throw new Error(
    `Initializer for setting "${
      info.path
    }" was configured with a static value. It must be a function. Got: ${inspect(specifier.initial)}`
  )
}

/**
 * Validate the spec for basic invariants.
 */
function validateSpec(spec: any) {
  Lo.forOwn(spec, (specifier: any, name: string) => {
    if (specifier.fields) {
      validateSpec(specifier.fields)
      return
    }

    if (isRecordSpecifier(specifier)) {
      validateSpec(specifier.entry)
      return
    }

    if (specifier.mapType !== undefined && typeof specifier.mapType !== 'function') {
      throw new Error(
        `Type mapper for setting "${name}" was invalid. Type mappers must be functions. Got: ${inspect(
          specifier.mapType
        )}`
      )
    }
  })
}

/**
 * utils
 */

/**
 * Check if curerntly in production mode defined as
 * NODE_ENV environment variable equaling "production".
 */
function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

/**
 * Check if curerntly in development mode defined as
 * NODE_ENV environment variable not equaling "production".
 */
function isDevelopment(): boolean {
  return process.env.NODE_ENV !== 'production'
}

function mergeShallow(o1: any, o2: any) {
  for (const [k, v] of Object.entries(o2)) {
    if (v !== undefined) {
      o1[k] = v
    }
  }
  return o1
}
