declare global {
  interface NexusBackingTypes {}
}

type GenTypesShapeKeys = 'types'

/**
 * Helpers for handling the generated backing types typgen
 */
type GenTypesShape = Record<GenTypesShapeKeys, any>

export type GetNexusFutureGen<
  K extends GenTypesShapeKeys,
  Fallback = any
> = NexusBackingTypes extends infer GenTypes
  ? GenTypes extends GenTypesShape
    ? GenTypes[K]
    : Fallback
  : Fallback
