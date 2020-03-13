import * as NexusSchema from '@nexus/schema'
import * as Schema from '../../runtime/schema'
import { suggestionList } from '../levenstein'
import { rootLogger } from '../nexus-logger'
import { BackingTypes } from './types'

const log = rootLogger.child('backing-types')

export function withRemappedRootTypings(
  types: Schema.AllNexusTypeDefs[],
  backingTypes: BackingTypes
) {
  return types.map(t => {
    if (
      NexusSchema.core.isNexusObjectTypeDef(t) ||
      NexusSchema.core.isNexusInterfaceTypeDef(t) ||
      NexusSchema.core.isNexusUnionTypeDef(t) ||
      NexusSchema.core.isNexusScalarTypeDef(t) ||
      NexusSchema.core.isNexusEnumTypeDef(t)
    ) {
      if (typeof t.value.rootTyping === 'string') {
        const filePath = backingTypes[t.value.rootTyping]

        if (t.value.rootTyping.length === 0) {
          return t
        }

        if (!filePath) {
          const suggestions = suggestionList(
            t.value.rootTyping,
            Object.keys(backingTypes)
          )

          log.warn(
            `We could not find the backing type '${t.value.rootTyping}' used in '${t.name}'`
          )
          if (suggestions.length > 0) {
            log.warn(
              `Did you mean ${suggestions.map(s => `"${s}"`).join(', ')} ?`
            )
          }
          return t
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
