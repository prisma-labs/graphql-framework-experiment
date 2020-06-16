import { DateTimeResolver, JSONObjectResolver } from 'graphql-scalars'
import { GraphQLScalarType } from 'graphql'

export type Scalars = Record<string, GraphQLScalarType>

interface BuiltinScalars {
  Date: GraphQLScalarType
  Json: GraphQLScalarType
  [x: string]: GraphQLScalarType
}

export const builtinScalars: BuiltinScalars = {
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
}
