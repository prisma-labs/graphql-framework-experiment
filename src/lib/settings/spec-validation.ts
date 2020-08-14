import * as Lo from 'lodash'
import { inspect } from 'util'
import {
  appendPath,
  isNamespaceSpecifier,
  isRecordSpecifier,
  renderPath,
  Specifier,
  SpecifierNamespace,
  TraversalInfo,
} from './settings'

/**
 * Validate the spec for basic invariants.
 * todo mapData mapEntryData fixup etc.
 */
export function validateSpecifier(specifier: Specifier, info: TraversalInfo) {
  if (isNamespaceSpecifier(specifier)) {
    Lo.forOwn(specifier.fields, (fieldSpecifier: Specifier, fieldName: string) => {
      validateSpecifier(fieldSpecifier, appendPath(info, fieldName))
    })
    return
  }

  if (isRecordSpecifier(specifier)) {
    validateSpecifier(specifier.entry as SpecifierNamespace, info)
    return
  }

  if (specifier.mapType !== undefined && typeof specifier.mapType !== 'function') {
    throw new Error(
      `Type mapper for setting "${renderPath(
        info
      )}" was invalid. Type mappers must be functions. Got: ${inspect(specifier.mapType)}`
    )
  }
}
