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
const DEV_MODE_ENV_VAR_NAME = 'PUMPKINS_DEV_MODE'

/**
 * Eager integrity check.
 */
assertDevModeIPCIntegrityCheck()
const IS_DEV_MODE = parseIsDevMode()

/**
 * Constant for the server ready signal
 */
export const SERVER_READY_SIGNAL = 'ready'

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

  process.send!({ [signal]: true, cmd: 'NODE_DEV' })
}

/**
 * parse the dev mode environment variable
 */
function parseIsDevMode(): boolean {
  if (
    process.env[DEV_MODE_ENV_VAR_NAME] !== undefined &&
    process.env[DEV_MODE_ENV_VAR_NAME] !== 'true'
  ) {
    fatal(
      `${DEV_MODE_ENV_VAR_NAME} was found set to an unsupported vaue. Must be undefined or "true".`
    )
  }

  return process.env[DEV_MODE_ENV_VAR_NAME] === 'true'
}
/**
 * This function checks that dev mode and IPC are algined. IPC should only be
 * enabled when dev mode master is running pumpkins app within its runner
 * process. Dev mode being on or off is signified via a special environment
 * variable. If the environment variable is ever present but IPC not then this
 * means something is deeply wrong, and explicitly or subtlely not going to work.
 *
 * TODO this comment rationale/example is bad, since ts-node, how we use it, is not forking...
 *      ... actually we do, in typegen, mention that, but still, does ts-node
 *      actually fork... ?
 *
 * We DO allow for IPC to be enabled while dev-mode is not, since we cannot
 * control all the cases where pumpkins code might be forked and thus have IPC.
 * For example typegen which uses ts-node under the hood does a spawn, but
 * ts-node does a fork, and thus creates an IPC link.
 */
function devModeIPCIntegrityCheck():
  | { ok: true; reason: null }
  | { ok: false; reason: null | 'env_but_no_ipc' } {
  const isDevModeEnabled: boolean = parseIsDevMode()
  const isIPCEnabled: boolean = typeof process.send === 'function'

  if (!isDevModeEnabled) {
    return { ok: true, reason: null }
  }

  if (isDevModeEnabled && isIPCEnabled) {
    return { ok: true, reason: null }
  }

  if (isDevModeEnabled && !isIPCEnabled) {
    return { ok: false, reason: 'env_but_no_ipc' }
  }

  return undefined as never
}

/**
 * Check that dev-mode <> IPC integrity is intact else halt the program.
 */
function assertDevModeIPCIntegrityCheck(): void {
  const status = devModeIPCIntegrityCheck()
  if (!status.ok) {
    fatal(
      'dev-mode <> IPC integrity check has failed with the follow reason: %s',
      status.reason
    )
  }
}

/**
 * Log a meaningful semantic error message sans stack track and then crash
 * the program with exit code 1. Parameters are a passthrough to `console.error`.
 */
function fatal(format: string, ...vars: unknown[]): void {
  console.error(format, ...vars)
  process.exit(1)
}
