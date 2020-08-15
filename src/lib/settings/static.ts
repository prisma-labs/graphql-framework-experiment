/**
 * This module only deals with the type level (no term level)
 * It contains the rich conditional type system powering the settings library.
 */

import { PartialDeep, Primitive } from 'type-fest'
import {
  ExcludePlainObjectOrInterface,
  ExcludeUndefined,
  Includes,
  IncludesPlainObjectOrInterface,
  IncludesRecord,
  IsSameKeys,
  KeepOptionalKeys,
  KeepRequiredKeys,
  Lookup,
  OnlyPlainObjectOrInterface,
  PlainObject,
} from '../utils'

export type ExcludeShorthand<T> = OnlyPlainObjectOrInterface<T>

export type DataDefault<input> = {
  [k in keyof input]-?: IncludesPlainObjectOrInterface<input[k]> extends true
    ? DataDefault<OnlyPlainObjectOrInterface<input[k]>>
    : ExcludeUndefined<input[k]>
}

export type KeysWhereDataRequiredOrNotInData<Input, Data> = {
  [K in keyof Input]: K extends keyof Data ? (undefined extends Data[K] ? never : K) : K
}[keyof Input]

type KeysWhereDataOptionalOrNotInData<Input, Data> = {
  [K in keyof Input]: K extends keyof Data ? (undefined extends Data[K] ? K : never) : K
}[keyof Input]

type FilterInOverlappingKeys<T, U> = {
  [K in keyof T]: K extends keyof U ? K : never
}[keyof T]

type OnlyPropsInOther<T, U> = {
  [K in FilterInOverlappingKeys<T, U>]: T[K]
}

type NO_DATA_MATCH = 'NO_DATA_MATCH'

type Node<Input, Data, Key> = IncludesRecord<Lookup<Input, Key>> extends true
  ? RecordSpec<Lookup<Input, Key>, Key, Data>
  : IncludesPlainObjectOrInterface<Lookup<Input, Key>> extends true
  ? NamespaceSpec<Lookup<Input, Key>, Key, Data>
  : LeafSpec<Lookup<Input, Key>, Key, Data>

/**
 * todo
 */
// prettier-ignore
export type Spec<Input, Data> =
  (
    KeysWhereDataOptionalOrNotInData<Input, Data> extends never
      ? {}
      : { [Key in KeysWhereDataOptionalOrNotInData<Input, Data>]+?: Node<Input,Data,Key> }
  ) &
  (
    KeysWhereDataRequiredOrNotInData<Input, Data> extends never
      ? {}
      : { [Key in KeysWhereDataRequiredOrNotInData<Input, Data>]-?: Node<Input,Data,Key> }
  )

//prettier-ignore
export type NamespaceSpec<Input, Key, Data> =
  {
    fields: Spec<OnlyPlainObjectOrInterface<Input>, Lookup<Data, Key, NO_DATA_MATCH>>
  } &
  // todo jsdoc 1) when namespace has no matching data key then developer is responsible
  // todo to map the data tree over _somehow_. Impossible to know how, so return type is
  // todo any possible data. This logic is arbitrary and not guaranteed to work. You should
  // todo unit test it!
  (
    Lookup<Data, Key> extends never
      ? { mapData(input:ExcludeShorthand<Input>): PartialDeep<Data> }
      : {}
  ) &
  /**
   * If namespace is union with non-pojo type then shorthand required 
   */
  (
    ExcludeUndefined<ExcludePlainObjectOrInterface<Input>> extends never
    ? {}
    : {
        shorthand: Shorthand<ExcludeUndefined<ExcludePlainObjectOrInterface<Input>>, OnlyPlainObjectOrInterface<Input>>
      }
  ) &
  /**
   * If namespace is optional AND 1+ sub inputs are required THEN initializer required 
   *  ... if no data match THEN still required
   *  ... but if data optional THEN initial is forbidden (since we'll initialize namespace (data) to undefined)
   *  ... but if all namespace fields (input) are optional THEN initial is forbidden (b/c we can automate
   *      namespace (data) with namespace (input) field initializers)
   */
  (
    undefined extends Input
      ? {} extends KeepOptionalKeys<Input>
        ? {}
        : Includes<Lookup<Data,Key>, undefined> extends true
          ? {}
          : { initial(): KeepRequiredKeys<Exclude<Input, undefined>> }
      : {}
  )

// [1]
// If the field can be undefined it means that initial is not required.
// In most cases it probably means initial won't be supplied. However
// there are may be some odd cases where iniital is present but can
// return undefined.
// prettier-ignore
export type LeafSpec<Input, Key, Data> =
  {
    validate?: Validate<ExcludeUndefined<Input>>
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
    fixup?: Fixup<ExcludeUndefined<Input>>
  } &
  /**
   * if input is optional then initial is required
   * if input is optional and no matching data key then initial is required
   * if input is optional and matching data key optional then initial is optional
   */
  (
    undefined extends Input
      ? undefined extends Lookup<Data, Key>
        ? { initial?(): Input }
        : { initial(): ExcludeUndefined<Input> }
      : {}
  ) &
  /**
   * If there is not a direct mapping between input/data then
   * require mapping functions.
   */
  (
    // do not consider `... | undefined` b/c existence is handled specially
    NO_DATA_MATCH extends Data
      ? {} 
      :  Key extends keyof ExcludeUndefined<Data>
        ?
          ExcludeUndefined<Input> extends ExcludeUndefined<Data>[Key]
          ? {}
          : // if input key type does not match data then mapType is required
            { mapType: MapType<ExcludeUndefined<Input>, ExcludeUndefined<Data>[Key]> }
        : // if input key has no match in data then mapData is required
          { mapData: MapType<ExcludeUndefined<Input>, ExcludeUndefined<Data>> }
  )

/**
 * todo: currently assumes Record<string, object>
 */
// prettier-ignore
// todo how does no data match affect this?
export type RecordSpec<Dict, K, Data, DictEntry = Lookup<ExcludeUndefined<Dict>, string>> =
  // | { raw(input: Dict): Data[K] }
  (
    {
      /**
       * Specify the settings input for each entry in the record.
       */
      // todo how does no data match affect this?
      entry: Node<OnlyPlainObjectOrInterface<ExcludeUndefined<Dict>>, Lookup<Data,K>, string>
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
    // /**
    //  * If namespace is union with non-pojo type then shorthand required
    //  */
    // (ExcludePlainObjectOrInterface<DictEntry> extends never
    //   ? {}
    //   : {
    //       // Reason for ExcludeUndefined is that a type with optional properties + index
    //       // sig will force the index sig to have undefined. This pattern seems common enough
    //       // to support here, and harmless, since, pure records shouldn't have semantic meaning of
    //       // undefined value on keys.
    //       entryShorthand(
    //         input: ExcludeUndefined<ExcludePlainObjectOrInterface<DictEntry>>
    //       ): OnlyPlainObjectOrInterface<DictEntry>
    //     }) &
    /**
     * if input is optional then initial is required
     * unless all
     */
    (
      undefined extends Dict
      ? {
          /**
           * Initialize the record with some entries. By default the record will be an empty object.
           */
          initial?(): ExcludeUndefined<Dict>
        }
      : {
          /**
           * Initialize the record with some entries. Although you require users to input a record, your initializer will still be run too, if provided.
           */
          initial?(): ExcludeUndefined<Dict>
        }
    ) &
    /**
     * if data has fields that are not present in input THEN mapData is required
     */
    (
      // todo how does no data match affect this?
      IsSameKeys<Required<Lookup<Lookup<Data,K>,string>>, ExcludeShorthand<Required<DictEntry>>> extends true
      ? {}
      : {
          // todo how does no data match affect this?
          mapEntryData(data: OnlyPropsInOther<Lookup<Lookup<Data,K>,string>, ExcludeShorthand<DictEntry>>, key: string): Lookup<Lookup<Data,K>,string>
        }
    )

/**
 * Isolated Types
 */

export type Validate<Input = Primitive> = (value: Input) => null | { messages: string[] }

export type Fixup<Input = Primitive> = (input: Input) => null | { value: Input; messages: string[] }

export type MapType<Input = Primitive, Return = Primitive> = (input: Input) => Return

export type Shorthand<Input = Primitive, Return = PlainObject> = (input: Input) => Return
