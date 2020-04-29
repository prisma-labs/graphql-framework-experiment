export const REFLECTION_ENV_VAR = 'NEXUS_REFLECTION'

/**
 * Set the NEXUS_REFLECTION environment variable
 */
export function setReflectionStage() {
  process.env[REFLECTION_ENV_VAR] = 'true'
}

/**
 * Check whether the app is executing in its reflection stage
 */
export function isReflectionStage() {
  return process.env[REFLECTION_ENV_VAR] === 'true'
}
