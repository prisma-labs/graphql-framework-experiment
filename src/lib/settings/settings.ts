import * as Lo from 'lodash'
import { Primitive } from 'type-fest'
import { inspect } from 'util'
import { PlainObject } from '../utils'

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

export type SettingsFieldSpec<T> = HasUndefined<T> extends true
  ? {
      initial?: T | (() => T) // [1]
      validate?: (value: T) => null | { message: string }
      fixup?: (value: T) => { value: T; fixups: string[] }
    }
  : {
      initial: T | (() => T)
      validate?: (value: T) => null | { message: string }
      fixup?: (value: T) => { value: T; fixups: string[] }
    }

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

export function create<Data, Input = Data>(spec: Spec<Data, Input>): Manager<Data, Input> {
  const state = {
    data: {} as Data,
    metadata: {} as Metadata<Data>,
  }

  runInitializers(state.data, spec)

  const api: Manager<Data, Input> = {
    data: state.data,
    metadata: state.metadata,
    change(input) {
      const inputNormalized = resolveShorthands(spec, input)
      Lo.merge(state.data, inputNormalized)
      return api
    },
    reset() {},
  }

  return api
}

function resolveShorthands<Input>(spec: any, input: Input): Input {
  const inputNormalized: AnyRecord = {}
  doResolveShorthands(spec, input, inputNormalized)
  return inputNormalized as any
}

function doResolveShorthands(spec: any, input: AnyRecord, inputNormalized: any) {
  Lo.forOwn(input, (value, name) => {
    const specifier = spec[name]
    const isValueObject = Lo.isPlainObject(value)

    if (!specifier) {
      throw new Error(`Could not find a setting specifier for setting "${name}"`)
    }

    if (!specifier.fields) {
      if (isValueObject) {
        throw new Error(
          `Setting "${name}" is not a namespace and so does not accept objects, but one given: ${inspect(
            value
          )}`
        )
      }
      inputNormalized[name] = value
    } else if (isValueObject) {
      const nestedInputNormalized = {}
      inputNormalized[name] = nestedInputNormalized
      doResolveShorthands(specifier.fields, value, nestedInputNormalized)
    } else if (specifier.shorthand) {
      console.log('running shorthand', { name })
      inputNormalized[name] = specifier.shorthand(value)
    } else {
      throw new Error(
        `Setting "${name}" is a namespace with no shorthand so expects an object but received a non-object: ${inspect(
          value
        )}`
      )
    }
  })
}

function runInitializers(data: any, spec: any) {
  Lo.forOwn(spec, (specifier: any, key: string) => {
    if (specifier.fields) {
      data[key] = data[key] ?? {}
      runInitializers(data[key], specifier.fields)
    } else {
      const value: any = typeof specifier.initial === 'function' ? specifier.initial() : specifier.initial
      console.log('initialize value', { key, value })
      data[key] = value
    }
  })
}
