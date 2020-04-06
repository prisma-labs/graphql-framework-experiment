/**
 * Helpers for handling the generated backing types typgen
 */
declare global {
  interface NexusBackingTypes {}
}

type GenTypesShapeKeys = 'types'

type GenTypesShape = Record<GenTypesShapeKeys, any>

export type GetNexusFutureGen<
  K extends GenTypesShapeKeys,
  Fallback = any
> = NexusBackingTypes extends infer GenTypes
  ? GenTypes extends GenTypesShape
    ? GenTypes[K]
    : Fallback
  : Fallback

export type BackingTypes = Record<string, string>
