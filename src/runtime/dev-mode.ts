import { fatal } from '../lib/process'

/**
 * Dev Mode is a module providing functions that support special dev-mode-only
 * features. This module is aware of when dev mode is on or off, and takes the
 * corresponding action. For example process.send IPC communication is available
 * in dev mode but not production builds. This module encapsulates doing the
 * right thing in relation to this.
 *
 * TODO we should have build-time optimizations that strip dev-mode imports so
 * that this entire module can be tree shaken away.
 *
 */

/**
 * Data
 */
export const DEV_MODE_ENV_VAR_NAME = 'NEXUS_DEV_MODE'

/**
 * Eager integrity check.
 */
// assertDevModeIPCIntegrityCheck()
const IS_DEV_MODE = isDevMode()

/**
 * Constant for the server ready signal
 */
export const SERVER_READY_SIGNAL = 'app_server_listening'

/**
 * Send a signal that lets dev-mode master know that server is booted and thus
 * ready to receive requests.
 */
export function sendServerReadySignalToDevModeMaster(): void {
  sendSignalToDevModeMaster(SERVER_READY_SIGNAL)
}
/**
 * Send a message to the dev mode master process.
 */
function sendSignalToDevModeMaster(signal: string) {
  if (!IS_DEV_MODE) return

  process.send!({ type: signal, data: {} })
}

/**
 * parse the dev mode environment variable
 */
export function isDevMode(): boolean {
  if (process.env[DEV_MODE_ENV_VAR_NAME] !== undefined && process.env[DEV_MODE_ENV_VAR_NAME] !== 'true') {
    fatal(`${DEV_MODE_ENV_VAR_NAME} was found set to an unsupported vaue. Must be undefined or "true".`)
  }

  return process.env[DEV_MODE_ENV_VAR_NAME] === 'true'
}
