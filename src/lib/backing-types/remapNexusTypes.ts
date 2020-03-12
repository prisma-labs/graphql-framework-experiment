import * as NexusSchema from '@nexus/schema'
import { AllNexusTypeDefs } from '../../framework/schema'
import { BackingTypes } from './extract'

export function remapNexusTypesWithBackingTypes(
  types: AllNexusTypeDefs[],
  backingTypes: BackingTypes
) {
  return types.map(t => {
    if (
      NexusSchema.core.isNexusObjectTypeDef(t) ||
      NexusSchema.core.isNexusInterfaceTypeDef(t) ||
      NexusSchema.core.isNexusUnionTypeDef(t)
    ) {
      if (typeof t.value.rootTyping === 'string') {
        const filePath = backingTypes[t.value.rootTyping]

        if (!filePath) {
          throw new Error(`Could not find rootTyping: ${t.value.rootTyping}`)
        }

        t.value.rootTyping = {
          name: t.value.rootTyping,
          path: filePath,
        }
      }
    }

    return t
  })
}
