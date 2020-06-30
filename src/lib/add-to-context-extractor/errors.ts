import { exceptionType } from '../utils'

export const forbiddenUnionTypeError = exceptionType<'ForbiddenUnionType', { unionType: string }>(
  'ForbiddenUnionType',
  () =>
    `Error in schema.addToContext: Top-level union types that are not composed entirely of interfaces, object literals, or type aliases that refers to object literals are not supported.`
)

export type ForbiddenUnionTypeError = ReturnType<typeof forbiddenUnionTypeError>