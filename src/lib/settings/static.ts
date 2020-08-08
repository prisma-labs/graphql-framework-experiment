/**
 * This module only deals with the type level (no term level)
 * It contains the rich conditional type system powering the settings library.
 */

import {
  ExcludePlainObjectOrInterface,
  ExcludeUndefined,
  Includes,
  IncludesPlainObjectOrInterface,
  IncludesRecord,
  KeepOptionalKeys,
  KeepRequiredKeys,
  OnlyPlainObjectOrInterface,
} from '../utils'

export type ExcludeShorthand<T> = OnlyPlainObjectOrInterface<T>

export type DataDefault<input> = {
  [k in keyof input]-?: IncludesPlainObjectOrInterface<input[k]> extends true
    ? DataDefault<OnlyPlainObjectOrInterface<input[k]>>
    : ExcludeUndefined<input[k]>
}

type KeysWhereDataRequired<Input, Data> = {
  // @ts-expect-error
  [K in keyof Input]: undefined extends Data[K] ? never : K
}[keyof Input]

type KeysWhereDataOptional<Input, Data> = {
  // @ts-expect-error
  [K in keyof Input]: undefined extends Data[K] ? K : never
}[keyof Input]

type FilterInKeys<T, U> = { [K in keyof T]: T[K] extends U ? K : never }[keyof T]
type FilterOutKeys<T, U> = { [K in keyof T]: T[K] extends U ? never : K }[keyof T]

/**
 * todo
 */
// prettier-ignore
export type Spec<Input, Data> =
  (
    KeysWhereDataOptional<Input, Data> extends never
      ? {}
      : {
        [Key in KeysWhereDataOptional<Input, Data>]+?: IncludesRecord<Input[Key]> extends true
          ? RecordSpec<Input[Key], Key, Data>
          : IncludesPlainObjectOrInterface<Input[Key]> extends true
          ? NamespaceSpec<Input[Key], Key, Data>
          : FieldSpec<Input[Key], Key, Data>
      }
  ) &
  (
    KeysWhereDataRequired<Input, Data> extends never
      ? {}
      : {
          [Key in KeysWhereDataRequired<Input, Data>]-?: IncludesRecord<Input[Key]> extends true
            ? RecordSpec<Input[Key], Key, Data>
            : IncludesPlainObjectOrInterface<Input[Key]> extends true
            ? NamespaceSpec<Input[Key], Key, Data>
            : FieldSpec<Input[Key], Key, Data>
        }
  )

//prettier-ignore
export type NamespaceSpec<Namespace, Key, Data> =
  {
    //todo ...?
    // @ts-ignore
    fields: Spec<OnlyPlainObjectOrInterface<Namespace>, Data[Key]>
  } &
  /**
   * If namespace is union with non-pojo type then shorthand required 
   */
  (
    ExcludeUndefined<ExcludePlainObjectOrInterface<Namespace>> extends never
    ? {}
    : {
        shorthand(input: ExcludeUndefined<ExcludePlainObjectOrInterface<Namespace>>): OnlyPlainObjectOrInterface<Namespace>
      }
  ) &
  /**
   * If namespace is optional AND 1+ sub input fields are required THEN initial is required 
   *  ... but if undefinable in data too THEN initial is forbidden (since we'll initialize namespace (data) to undefined)
   *  ... but if all namespace fields (input) are optional THEN initial is forbidden (b/c we can automate
   *      namespace (data) with namespace (input) field initializers)
   */
  (
    undefined extends Namespace
      ? {} extends KeepOptionalKeys<Namespace>
        ? {}
        //todo ...?
        // @ts-ignore
        : Includes<Data[Key], undefined> extends true
          ? {}
          : { initial(): KeepRequiredKeys<Exclude<Namespace, undefined>> }
      : {}
  )

// [1]
// If the field can be undefined it means that initial is not required.
// In most cases it probably means initial won't be supplied. However
// there are may be some odd cases where iniital is present but can
// return undefined.
// prettier-ignore
export type FieldSpec<Field, Key, Data> =
  // | { raw(input: Field): Lookup<ExcludeUndefined<Data>, Key> }
  {
    validate?(value: ExcludeUndefined<Field>): null | { messages: string[] }
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
    fixup?(value: ExcludeUndefined<Field>): null | { value: Field; messages: string[] }
  } &
  /**
   * if input is optional initial is required
   * ... unless the data is optional too
   */
  (
    undefined extends Field
      // @ts-ignore
      ? undefined extends Data[Key]
        ? { initial?(): Field }
        : { initial(): ExcludeUndefined<Field> }
      : {}
  ) &
  /**
   * If there is not a direct mapping between input/data then
   * require mapping functions.
   */
  (
    // do not consider `... | undefined` b/c existence is handled specially
    Key extends keyof ExcludeUndefined<Data>
      ?
        ExcludeUndefined<Field> extends ExcludeUndefined<Data>[Key]
        ? {}
        : // if input key type does not match data then mapType is required
          { mapType(input: ExcludeUndefined<Field>): ExcludeUndefined<Data>[Key] }
      : // if input key has no match in data then mapData is required
        { mapData(input: ExcludeUndefined<Field>): ExcludeUndefined<Data> }
  )

/**
 * todo: currently assumes Record<string, object>
 */
// prettier-ignore
// @ts-expect-error
export type RecordSpec<Dict, K, Data, VarEntryInput = ExcludeUndefined<Dict>[string]> =
  // | { raw(input: Dict): Data[K] }
  (
    {
        /**
         * Specify the settings input for each entry in the record.
         */
          // @ts-expect-error
        entryFields: Spec<VarEntryInput, Data[K][string]>
    }
  ) &
  // (
  //   KeysWhereDataRequired<Spec<VarEntryInput, Data[K][string]>, Data[K][string]> extends never
  //   ? {
  //       /**
  //        * Specify the record entry settings.
  //        */
  //       entryFields: Spec<VarEntryInput, Data[K][string]>
  //     }
  //   : {
  //     a: [Data, K]
  //       /**
  //        * Specify the settings that each entry will have.
  //        * 
  //        * @remarks Optional because all of the settings data is optional.
  //        */
  //       entryFields?: Spec<VarEntryInput, Data[K][string]>
  //     }
  //   ) &
    /**
     * If namespace is union with non-pojo type then shorthand required
     */
    (ExcludePlainObjectOrInterface<VarEntryInput> extends never
      ? {}
      : {
          // Reason for ExcludeUndefined is that a type with optional properties + index
          // sig will force the index sig to have undefined. This pattern seems common enough
          // to support here, and harmless, since, pure records shouldn't have semantic meaning of
          // undefined value on keys.
          entryShorthand(
            input: ExcludeUndefined<ExcludePlainObjectOrInterface<VarEntryInput>>
          ): OnlyPlainObjectOrInterface<VarEntryInput>
        }) &
    /**
     * if input is optional then initial is required
     * unless all
     */
    (
      undefined extends Dict
      ? FilterOutKeys<VarEntryInput, undefined> extends never
        ? {
            initial?(): ExcludeUndefined<Dict>
          }
        : {
            initial?(): ExcludeUndefined<Dict>
          }
      : {
          /**
           * You require users to supply a record setting however you can still define initial here. Can be useful to pre-load some entries.
           */
          initial?(): ExcludeUndefined<Dict>
        }
    ) &
    /**
     * if data has fields that are not present in input THEN mapData is required
     */
    // @ts-expect-error
    (ExcludeShorthand<Required<VarEntryInput>> extends Required<Data[K][string]>
      ? {}
      : {
          // @ts-expect-error
          mapEntryData(input: ExcludeShorthand<VarEntryInput>): Data[K][string]
        })
