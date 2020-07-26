import { Primitive } from 'type-fest'
import { PlainObject } from '../utils'

type HasUndefined<T> = (T extends undefined ? true : never) extends never ? false : true

type HasPlainObject<T> = (T extends PlainObject ? true : never) extends never ? false : true

export type Spec<Data, Input> = {
  [Key in keyof Data]-?: HasPlainObject<Data[Key]> extends true
    ? SettingsNamespaceSpec<Data[Key], Key extends keyof Input ? Input[Key] : unknown>
    : SettingsFieldSpec<Data[Key]>
}

export interface SettingsNamespaceSpec<Data, Input> {
  shorthand?(value: Exclude<Input, undefined | Exclude<Input, Primitive>>): Exclude<Input, Primitive>
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
  change(input: Input): void
  metadata: Metadata<Data>
  data: Data
}

export function create<Data, Input>(spec: Spec<Data, Input>): Manager<Data, Input> {
  return 'todo' as any
}
