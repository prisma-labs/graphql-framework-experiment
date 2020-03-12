import * as NexusSchema from '@nexus/schema'
import * as BackingTypes from '../../lib/backing-types'

type RootTyping =
  | BackingTypes.GetNexusFutureGen<'types'>
  | NexusSchema.core.RootTypingImport

export interface NexusObjectTypeConfig<TypeName extends string>
  extends Exclude<
    NexusSchema.core.NexusObjectTypeConfig<TypeName>,
    'rootTyping'
  > {
  rootTyping?: RootTyping
}

export interface NexusInterfaceTypeConfig<TypeName extends string>
  extends Exclude<
    NexusSchema.core.NexusInterfaceTypeConfig<TypeName>,
    'rootTyping'
  > {
  rootTyping?: RootTyping
}

export interface NexusUnionTypeConfig<TypeName extends string>
  extends Exclude<
    NexusSchema.core.NexusUnionTypeConfig<TypeName>,
    'rootTyping'
  > {
  rootTyping?: RootTyping
}

export interface NexusEnumTypeConfig<TypeName extends string>
  extends Exclude<NexusSchema.core.EnumTypeConfig<TypeName>, 'rootTyping'> {
  rootTyping?: RootTyping
}

export interface NexusScalarTypeConfig<TypeName extends string>
  extends Exclude<
    NexusSchema.core.NexusScalarTypeConfig<TypeName>,
    'rootTyping'
  > {
  rootTyping?: RootTyping
}
