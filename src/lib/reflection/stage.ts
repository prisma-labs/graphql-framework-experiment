export const REFLECTION_ENV_VAR = 'NEXUS_REFLECTION'

export type ReflectionType = 'plugin' | 'typegen'

/**
 * Set the NEXUS_REFLECTION environment variable
 */
export function getReflectionStageEnv(type: ReflectionType) {
  return {
    [REFLECTION_ENV_VAR]: type,
  }
}

export function setReflectionStage(type: ReflectionType) {
  process.env[REFLECTION_ENV_VAR] = type
}

export function unsetReflectionStage() {
  // assigning `undefined` will result in envar becoming string 'undefined'
  delete process.env[REFLECTION_ENV_VAR]
}

/**
 * Check whether the app is executing in a particular reflection stage.
 */
export function isReflectionStage(type: ReflectionType) {
  return process.env[REFLECTION_ENV_VAR] === type
}

/**
 * Check whether the app is executing in any reflection stage.
 */
export function isReflection() {
  return process.env[REFLECTION_ENV_VAR] !== undefined
}
