import * as Logger from '@nexus/logger'
import * as Lo from 'lodash'
import { PartialDeep, Primitive } from 'type-fest'
import { inspect } from 'util'
import { PlainObject } from '../utils'

const log = Logger.log.child('settings')

type AnyRecord = { [k: string]: any }

// todo allow classes, regexp etc.
// todo allow anything except void & plain objects
// todo allow functions
type ExcludePlainObjectAndVoid<T> = Exclude<T, undefined | Exclude<T, Primitive | Primitive[] | Function>>

// type MaybeArray<T> = T | T[]

type HasUndefined<T> = (T extends undefined ? true : never) extends never ? false : true

type HasPlainObject<T> = (T extends PlainObject ? true : never) extends never ? false : true

export type Spec<Data, Input> = {
  [Key in keyof Data]-?: HasPlainObject<Data[Key]> extends true
    ? SettingsNamespaceSpec<Data[Key], Key extends keyof Input ? Input[Key] : unknown>
    : SettingsFieldSpec<Data[Key]>
}

export interface SettingsNamespaceSpec<Data, Input> {
  shorthand?(value: ExcludePlainObjectAndVoid<Input>): Exclude<Input, Primitive>
  fields: Spec<Data, Input>
}

// [1]
// If the field can be undefined it means that initial is not required.
// In most cases it probably means initial won't be supplied. However
// there are may be some odd cases where iniital is present but can
// return undefined.
export type SettingsFieldSpec<T> = {
  validate?: (value: T) => null | { messages: string[] }
  /**
   * Specify a fixup for this setting.
   *
   * A "fixup" corrects minor problems in a
   * given setting. It also provides a human readable message about what was
   * done and why.
   *
   * Return null if no fixup was needed. Return a fixup object
   * otherwise. The new value should be returned along with a list of one or
   * more messages, one for each thing that was fixed.
   */
  fixup?: (value: T) => null | { value: T; messages: string[] }
} & (HasUndefined<T> extends true
  ? {
      initial?: T | (() => T) // [1]
    }
  : {
      initial: T | (() => T)
    })

// export type SettingsFieldSpec<T> = HasUndefined<T> extends true
//   ? {
//       initial?: T | (() => T) // [1]
//       validate?: (value: T) => null | { message: string }
//       fixup?: (value: T) => null | { value: T; fixups: string[] }
//     }
//   : {
//       initial: T | (() => T)
//       validate?: (value: T) => null | { message: string }
//       fixup?: (value: T) => null | { value: T; fixups: string[] }
//     }

export type Metadata<Data> = {
  [Key in keyof Data]: Data[Key] extends Primitive
    ? {
        value: Data[Key]
        initial: Data[Key]
        from: 'set' | 'initial'
      }
    : {
        fields: Metadata<Data[Key]>
      }
}

export type Manager<Data, Input> = {
  reset(): Manager<Data, Input>
  change(input: Input): Manager<Data, Input>
  original(): Data
  metadata: Metadata<Data>
  data: Data
}

// todo errors currently report names of setting fields, but not the namespaces
// to it (if any)
// todo should onFixup be replaced with a batch version of onfixups that gets
// called with all fixups that happened for all of the input?
// todo ditto validation?
// todo allow env vars to populate settings
// todo track env var as value source
// todo $initial magic var to reset settting to its original state, re-running
// dynamic initializers if necessary

export type FixupInfo = { name: string; before: unknown; after: unknown; messages: string[] }

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

export function create<Data, Input = PartialDeep<Data>>({
  spec,
  ...options
}: {
  spec: Spec<Data, Input>
} & Options): Manager<Data, Input> {
  const state = {
    data: {} as Data,
    original: (undefined as any) as Data, // lazy
    metadata: {} as Metadata<Data>,
  }

  initialize(spec, state.data, state.metadata)

  const api: Manager<Data, Input> = {
    data: state.data,
    metadata: state.metadata,
    change(input) {
      resolve(options, spec, input, state.data, state.metadata)
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

function resetMetadata(metadata: any) {
  Lo.forOwn(metadata, (info, name) => {
    if (info.fields) {
      resetMetadata(info.fields)
    } else {
      info.value = info.initial
      info.from = 'initial'
    }
  })
}

function metadataToData<Data>(metadata: any, copy: AnyRecord): Data {
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
function resolve(options: Options, spec: any, input: AnyRecord, data: AnyRecord, metadata: AnyRecord) {
  Lo.forOwn(input, (value, name) => {
    const specifier = spec[name]
    const isValueObject = Lo.isPlainObject(value)

    if (!specifier) {
      throw new Error(`Could not find a setting specifier for setting "${name}"`)
    }

    if (isValueObject && !specifier.fields) {
      throw new Error(
        `Setting "${name}" is not a namespace and so does not accept objects, but one given: ${inspect(
          value
        )}`
      )
    }

    if (!isValueObject && specifier.fields && !specifier.shorthand) {
      throw new Error(
        `Setting "${name}" is a namespace with no shorthand so expects an object but received a non-object: ${inspect(
          value
        )}`
      )
    }

    if (isValueObject) {
      resolve(options, specifier.fields, value, data[name], metadata[name].fields)
    } else if (specifier.shorthand) {
      if (specifier.shorthand) {
        log.debug('expanding shorthand', { name })
        resolve(options, specifier.fields, specifier.shorthand(value), data[name], metadata[name].fields)
      }
    } else {
      let resolvedValue = value

      /**
       * Run fixups
       */
      if (specifier.fixup) {
        let maybeFixedup
        try {
          maybeFixedup = specifier.fixup(resolvedValue)
        } catch (e) {
          // todo use verror or like
          throw new Error(
            `Fixup for "${name}" failed while running on value ${inspect(resolvedValue)}:\n${e}`
          )
        }
        if (maybeFixedup) {
          resolvedValue = maybeFixedup.value
          /**
           * on fixup event callback
           */
          try {
            options.onFixup?.(
              {
                before: value,
                after: maybeFixedup.value,
                name,
                messages: maybeFixedup.messages,
              },
              onFixup
            )
          } catch (e) {
            // todo use verror or like
            throw new Error(`onFixup callback for "${name}" failed:\n${e}`)
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
          throw new Error(
            `Validation for "${name}" unexpectedly failed while running on value ${inspect(
              resolvedValue
            )}:\n${e}`
          )
        }
        if (maybeViolation) {
          throw new Error(
            `Your setting "${name}" failed validation with value ${inspect(
              resolvedValue
            )}:\n\n- ${maybeViolation.messages.join('\n- ')}`
          )
        }
      }

      data[name] = resolvedValue
      metadata[name].value = resolvedValue
      metadata[name].from = 'set'
    }
  })

  return data
}

/**
 * Initialize the settings data with each datum's respective initializer
 * specified in the settings spec.
 */
function initialize(spec: any, data: AnyRecord, metadata: AnyRecord) {
  Lo.forOwn(spec, (specifier: any, name: string) => {
    if (specifier.fields) {
      data[name] = data[name] ?? {}
      metadata[name] = metadata[name] ?? { fields: {} }
      initialize(specifier.fields, data[name], metadata[name].fields)
    } else {
      const value: any = typeof specifier.initial === 'function' ? specifier.initial() : specifier.initial
      log.trace('initialize value', { name, value })
      data[name] = value
      metadata[name] = { value, from: 'initial', initial: value }
    }
  })
}
