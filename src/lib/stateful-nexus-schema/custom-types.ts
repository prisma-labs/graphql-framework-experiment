/**
 * NOTE:
 * This module is temporary until the backing-types API is implemented in @nexus/schema
 * This should be deleted once it's done.
 */

import * as NexusSchema from '@nexus/schema'
import * as BackingTypes from '../backing-types'

type RootTyping =
  | BackingTypes.GetNexusFutureGen<'types'>
  | NexusSchema.core.RootTypingImport

export interface NexusObjectTypeConfig<TypeName extends string>
  extends Exclude<
    NexusSchema.core.NexusObjectTypeConfig<TypeName>,
    'rootTyping'
  > {
  /**
   * Root type information for this type.
   * By default, types are extracted for any .ts file in your project. You can configure that from the `schema.rootTypingsGlobPattern` setting
   *
   * @example
   *
   * export type MyRootType = { ... }
   *
   * schema.objectType({
   *   name: 'MyObjectType',
   *   rootTyping: 'MyRootType'
   * })
   */
  rootTyping?: RootTyping
}

export interface NexusInterfaceTypeConfig<TypeName extends string>
  extends Exclude<
    NexusSchema.core.NexusInterfaceTypeConfig<TypeName>,
    'rootTyping'
  > {
  /**
   * Root type information for this type.
   * By default, types are extracted for any .ts file in your project. You can configure that from the `schema.rootTypingsGlobPattern` setting
   *
   * @example
   *
   * export type MyRootType = { ... }
   *
   * schema.interfaceType({
   *   name: 'MyInterfaceType',
   *   rootTyping: 'MyRootType'
   * })
   */
  rootTyping?: RootTyping
}

export interface NexusUnionTypeConfig<TypeName extends string>
  extends Exclude<
    NexusSchema.core.NexusUnionTypeConfig<TypeName>,
    'rootTyping'
  > {
  /**
   * Root type information for this type.
   * By default, types are extracted for any .ts file in your project. You can configure that from the `schema.rootTypingsGlobPattern` setting
   *
   * @example
   *
   * export type MyRootType = { ... }
   *
   * schema.unionType({
   *   name: 'MyUnionType',
   *   rootTyping: 'MyRootType'
   * })
   */
  rootTyping?: RootTyping
}

export interface NexusEnumTypeConfig<TypeName extends string>
  extends Exclude<NexusSchema.core.EnumTypeConfig<TypeName>, 'rootTyping'> {
  /**
   * Root type information for this type.
   * By default, types are extracted for any .ts file in your project. You can configure that from the `schema.rootTypingsGlobPattern` setting
   *
   * @example
   *
   * export type MyRootType = { ... }
   *
   * schema.enumType({
   *   name: 'MyEnumType',
   *   rootTyping: 'MyRootType'
   * })
   */
  rootTyping?: RootTyping
}

export interface NexusScalarTypeConfig<TypeName extends string>
  extends Exclude<
    NexusSchema.core.NexusScalarTypeConfig<TypeName>,
    'rootTyping'
  > {
  /**
   * Root type information for this type.
   * By default, types are extracted for any .ts file in your project. You can configure that from the `schema.rootTypingsGlobPattern` setting
   *
   * @example
   *
   * export type MyRootType = { ... }
   *
   * schema.scalarType({
   *   name: 'MyScalarType',
   *   rootTyping: 'MyRootType'
   * })
   */
  rootTyping?: RootTyping
}
