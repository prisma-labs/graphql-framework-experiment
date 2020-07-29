import * as Logger from '@nexus/logger'
import * as Lo from 'lodash'
import { PartialDeep, Primitive } from 'type-fest'
import { inspect } from 'util'
import { PlainObject } from '../utils'

const log = Logger.log.child('settings')

type AnyRecord = Record<string, any>

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
  validate?: (value: T) => null | { message: string }
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
        source: 'api' | 'initial'
      }
    : Metadata<Data[Key]>
}

export type Manager<Data, Input> = {
  reset(): void
  change(input: Input): Manager<Data, Input>
  metadata: Metadata<Data>
  data: Data
}

export type Options = {
  onFixup?: (info: { name: string; before: unknown; after: unknown; messages: string[] }) => void
}

export function create<Data, Input = PartialDeep<Data>>({
  spec,
  ...options
}: {
  spec: Spec<Data, Input>
} & Options): Manager<Data, Input> {
  const state = {
    data: {} as Data,
    metadata: {} as Metadata<Data>,
  }

  runInitializers(state.data, spec)

  const api: Manager<Data, Input> = {
    data: state.data,
    metadata: state.metadata,
    change(input) {
      const resolvedInput = resolve(options, spec, input, {})
      // const longhandInputAndFixed = resolveFixups(spec, longhandInput, {})
      Lo.merge(state.data, resolvedInput)
      return api
    },
    reset() {},
  }

  return api
}

/**
 * Process the given input through the settings spec, resolving its shorthands,
 * fixups, validation and so on. The input is not mutated, but the input copy
 * is. The input copy is returned.
 */
function resolve(options: Options, spec: any, input: AnyRecord, inputCopy: any) {
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
      inputCopy[name] = resolve(options, specifier.fields, value, {})
    } else if (specifier.shorthand) {
      if (specifier.shorthand) {
        log.debug('expanding shorthand', { name })
        inputCopy[name] = resolve(options, specifier.fields, specifier.shorthand(value), {})
      }
    } else {
      let resolvedValue = value

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
          try {
            options.onFixup?.({
              before: value,
              after: maybeFixedup.value,
              name,
              messages: maybeFixedup.messages,
            })
          } catch (e) {
            // todo use verror or like
            throw new Error(`onFixup callback for "${name}" failed:\n${e}`)
          }
        }
      }

      inputCopy[name] = resolvedValue
    }
  })

  return inputCopy
}

/**
 * Initialize the settings data with each datum's respective initializer
 * specified in the settings spec.
 */
function runInitializers(data: any, spec: any) {
  Lo.forOwn(spec, (specifier: any, key: string) => {
    if (specifier.fields) {
      data[key] = data[key] ?? {}
      runInitializers(data[key], specifier.fields)
    } else {
      const value: any = typeof specifier.initial === 'function' ? specifier.initial() : specifier.initial
      log.trace('initialize value', { key, value })
      data[key] = value
    }
  })
}
