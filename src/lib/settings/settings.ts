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
    ? Record<string, Metadata<Data[string]>>
    : Data[Key] extends PlainObject
    ? {
        fields: Metadata<Data[Key]>
      }
    : {
        value: Data[Key]
        initial: Data[Key]
        from: MetadataValueFromType
      }
}

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

function onFixup(info: FixupInfo): void {
  log.warn(
    'One of your setting values was invalid. We were able to automaticlaly fix it up now but please update your code.',
    info
  )
}

export function create<Input extends PlainObject, Data extends PlainObject = DataDefault<Input>>({
  spec,
  ...options
}: {
  spec: Spec<Input, Data>
} & Options): Manager<Input, Data> {
  if (isDevelopment()) {
    validateSpec(spec)
  }

  const state = {
    data: {} as Data,
    original: (undefined as any) as Data, // lazy
    metadata: {} as any, // Metadata<Data>,
  }

  initialize(spec, state.data, state.metadata)

  const api: Manager<Input, Data> = {
    data: state.data,
    metadata: state.metadata,
    change(input) {
      resolve(options, 'set', spec, input, state.data, state.metadata)
      return api
    },
    reset() {
      api.data = state.data = {} as any
      api.metadata = state.metadata = {} as any
      initialize(spec, state.data, state.metadata)
      return api
    },
    original() {
      const original = state.original ?? metadataToData(state.metadata, {})
      return original
    },
  }

  return api
}

function metadataToData<Data>(metadata: any, copy: PlainObject): Data {
  Lo.forOwn(metadata, (info, name) => {
    if (info.fields) {
      copy[name] = metadataToData(info.fields, {})
    } else {
      copy[name] = info.initial
    }
  })

  return copy as any
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
  Lo.forOwn(input, (inputFieldValue, inputFieldName) => {
    const specifier = fields[inputFieldName]
    const isValueObject = Lo.isPlainObject(inputFieldValue)

    if (!specifier) {
      throw new Error(
        `You are trying to change a setting called "${inputFieldName}" but no such setting exists`
      )
    }

    if (isValueObject && !specifier.fields && !specifier.entryFields) {
      throw new Error(
        `Setting "${inputFieldName}" is not a namespace and so does not accept objects, but one given: ${inspect(
          inputFieldValue
        )}`
      )
    }

    if (!isValueObject && specifier.fields && !specifier.shorthand) {
      throw new Error(
        `Setting "${inputFieldName}" is a namespace with no shorthand so expects an object but received a non-object: ${inspect(
          inputFieldValue
        )}`
      )
    }

    if (isValueObject) {
      if (specifier.fields) {
        resolve(
          options,
          metadataFrom,
          specifier.fields,
          inputFieldValue,
          data[inputFieldName],
          metadata[inputFieldName].fields
        )
      } else if (specifier.entryFields) {
        Lo.forOwn(inputFieldValue, (inputEntryValue, key) => {
          log.trace('changing record entry', { key, inputEntryValue })

          if (!data[inputFieldName][key]) {
            log.trace('initializing new record entry', { key })
            data[inputFieldName][key] = {}
            metadata[inputFieldName].value[key] = {}
            initialize(
              fields[inputFieldName].entryFields,
              data[inputFieldName][key],
              metadata[inputFieldName].value[key]
            )
          }

          resolve(
            options,
            metadataFrom,
            specifier.entryFields,
            inputEntryValue,
            data[inputFieldName][key],
            metadata[inputFieldName].value[key]
          )
        })
      } else {
        throw new Error(`Unknown kind of specifier: ${inspect(specifier)}`)
      }
    } else if (specifier.shorthand) {
      if (specifier.shorthand) {
        log.debug('expanding shorthand', { inputFieldName })
        let longhandValue
        try {
          longhandValue = specifier.shorthand(inputFieldValue)
        } catch (e) {
          throw ono(
            e,
            { inputFieldName, inputFieldValue },
            `There was an unexpected error while running the namespace shorthand for setting "${inputFieldName}". The given value was ${inspect(
              inputFieldValue
            )}`
          )
        }
        resolve(
          options,
          metadataFrom,
          specifier.fields,
          longhandValue,
          data[inputFieldName],
          metadata[inputFieldName].fields
        )
      }
    } else {
      let resolvedValue = inputFieldValue

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
            { inputFieldName, value: resolvedValue },
            `Fixup for "${inputFieldName}" failed while running on value ${inspect(resolvedValue)}`
          )
        }
        if (maybeFixedup) {
          resolvedValue = maybeFixedup.value
          /**
           * fixup handler
           */
          const fixupInfo = {
            before: inputFieldValue,
            after: maybeFixedup.value,
            name: inputFieldName,
            messages: maybeFixedup.messages,
          }
          if (options.onFixup) {
            try {
              options.onFixup(fixupInfo, onFixup)
            } catch (e) {
              throw ono(e, { inputFieldName }, `onFixup callback for "${inputFieldName}" failed`)
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
            { inputFieldName, value: resolvedValue },
            `Validation for "${inputFieldName}" unexpectedly failed while running on value ${inspect(
              resolvedValue
            )}`
          )
        }
        if (maybeViolation) {
          throw new Error(
            `Your setting "${inputFieldName}" failed validation with value ${inspect(
              resolvedValue
            )}:\n\n- ${maybeViolation.messages.join('\n- ')}`
          )
        }
      }

      /**
       * Run type mappers
       */
      if (specifier.mapType) {
        resolvedValue = runTypeMapper(specifier.mapType, resolvedValue, inputFieldName)
      }

      log.trace('committing data', { inputFieldName, value: resolvedValue })
      data[inputFieldName] = resolvedValue
      metadata[inputFieldName].value = resolvedValue
      metadata[inputFieldName].from = metadataFrom
      if (metadataFrom === 'initial') {
        metadata[inputFieldName].initial = resolvedValue
      }
    }
  })

  return data
}

/**
 * Initialize the settings data with each datum's respective initializer
 * specified in the settings spec.
 */
function initialize(fields: any, data: any, metadata: any) {
  Lo.forOwn(fields, (specifier: any, inputFieldName: string) => {
    if (specifier.fields) {
      log.trace('initialize input namespace', { inputFieldName })
      const initializedNamespace = specifier.initial?.() ?? {}
      data[inputFieldName] = data[inputFieldName] ?? initializedNamespace
      metadata[inputFieldName] = metadata[inputFieldName] ?? {
        fields: Lo.mapValues(initializedNamespace, (v, k) => ({ value: v, from: 'initial', initial: v })),
      }
      initialize(specifier.fields, data[inputFieldName], metadata[inputFieldName].fields)
    } else if (specifier.entryFields) {
      log.trace('initialize input record', { inputFieldName })
      // there may be preloaded record entries via the record initializer
      // such entries will be input and thus need to be resolved
      // such entries may also not account for all possible fields of the entry
      // thus we need to run the initializer and seed each entry with that
      // then treat the actual initialzer input as a "change" on that, resolving it
      const initialRecord = specifier.initial ? runInitializer(specifier, inputFieldName, data) : {}
      const initialRecordInitialized = Lo.chain(initialRecord)
        .entries()
        .reduce(
          (acc: any, [k, v]) => {
            const data = {}
            const metadata = {}
            initialize(specifier.entryFields, data, metadata)
            resolve({}, 'initial', specifier.entryFields, v, data, metadata)
            acc.data[k] = data
            acc.metadata[k] = metadata
            return acc
          },
          { data: {}, metadata: {} }
        )
        .value()
      data[inputFieldName] = initialRecordInitialized.data
      metadata[inputFieldName] =
        metadata[inputFieldName] ?? initMetadataRecord(initialRecordInitialized.metadata)
    } else {
      log.trace('initialize input field', { inputFieldName })
      let value = runInitializer(specifier, inputFieldName, data)

      if (specifier.mapType) {
        value = runTypeMapper(specifier.mapType, value, inputFieldName)
      }

      data[inputFieldName] = value
      metadata[inputFieldName] = initMetadataField(value)
    }
  })
}

function runInitializer(specifier: any, inputFieldName: string, data: any): any {
  if (specifier.initial === undefined) {
    log.trace('no initializer to run', { inputFieldName })
    // the namespace might have initialized some data
    return data[inputFieldName] ?? undefined
  }

  if (typeof specifier.initial === 'function') {
    log.trace('running initializer', { inputFieldName })
    try {
      return specifier.initial()
    } catch (e) {
      throw ono(
        e,
        { inputFieldName },
        `There was an unexpected error while running the initializer for setting "${inputFieldName}"`
      )
    }
  }

  throw new Error(
    `Initializer for setting "${inputFieldName}" was configured with a static value. It must be a function. Got: ${inspect(
      specifier.initial
    )}`
  )
}

/**
 *
 */
function initMetadataField(value: any) {
  return { value, from: 'initial', initial: value }
}

function initMetadataRecord(value: any) {
  return { type: 'record', from: 'initial', value, initial: Lo.cloneDeep(value) }
}

/**
 *
 */
function runTypeMapper(typeMapper: any, inputFieldValue: any, inputFieldName: string): any {
  log.trace('running type mapper', { inputFieldName, inputFieldValue })
  try {
    return typeMapper(inputFieldValue)
  } catch (e) {
    throw ono(
      e,
      { inputFieldName },
      `There was an unexpected error while running the type mapper for setting "${inputFieldName}"`
    )
  }
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

    if (specifier.entryFields) {
      validateSpec(specifier.entryFields)
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
