import * as NexusSchema from '@nexus/schema'
import { DateTimeResolver, JSONObjectResolver } from 'graphql-scalars'
import { GraphQLScalarType } from 'graphql'

export type Scalars = Record<string, GraphQLScalarType>

export const builtinScalars = {
  Date: new GraphQLScalarType({
    ...DateTimeResolver,
    name: 'Date',
  }),
  Json: new GraphQLScalarType({
    ...JSONObjectResolver,
    name: 'Json',
    description:
      'The `JSON` scalar type represents JSON objects as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf).',
  }),
} as const

export function mapBuiltinScalarsToNexusSchemaTypes() {
  return Object.entries(builtinScalars).map(([name, type]) => {
    type.name = name
    return NexusSchema.asNexusMethod(type, name.toLowerCase())
  })
}
