import * as NexusSchema from '@nexus/schema'
import * as BackingTypes from '../../lib/backing-types'

export interface NexusObjectTypeConfig<TypeName extends string>
  extends Exclude<
    NexusSchema.core.NexusObjectTypeConfig<TypeName>,
    'rootTyping'
  > {
  rootTyping?:
    | BackingTypes.GetNexusFutureGen<'types'>
    | NexusSchema.core.RootTypingImport
}

export interface NexusInterfaceTypeConfig<TypeName extends string>
  extends Exclude<
    NexusSchema.core.NexusInterfaceTypeConfig<TypeName>,
    'rootTyping'
  > {
  rootTyping?:
    | BackingTypes.GetNexusFutureGen<'types'>
    | NexusSchema.core.RootTypingImport
}

export interface NexusUnionTypeConfig<TypeName extends string>
  extends Exclude<
    NexusSchema.core.NexusUnionTypeConfig<TypeName>,
    'rootTyping'
  > {
  rootTyping?:
    | BackingTypes.GetNexusFutureGen<'types'>
    | NexusSchema.core.RootTypingImport
}

export interface NexusEnumTypeConfig<TypeName extends string>
  extends Exclude<NexusSchema.core.EnumTypeConfig<TypeName>, 'rootTyping'> {
  rootTyping?:
    | BackingTypes.GetNexusFutureGen<'types'>
    | NexusSchema.core.RootTypingImport
}

export interface NexusScalarTypeConfig<TypeName extends string>
  extends Exclude<
    NexusSchema.core.NexusScalarTypeConfig<TypeName>,
    'rootTyping'
  > {
  rootTyping?:
    | BackingTypes.GetNexusFutureGen<'types'>
    | NexusSchema.core.RootTypingImport
}
