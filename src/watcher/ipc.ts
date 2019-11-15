import { ChildProcess } from 'child_process'

/**
 * Checks if the given message is an internal node-dev message.
 */
function isNodeDevMessage(m: any) {
  return m.cmd === 'NODE_DEV'
}

/**
 * Sends a message to the given process.
 */
export function send(msg: any, dest?: NodeJS.Process) {
  msg.cmd = 'NODE_DEV'
  if (!dest) {
    dest = process
  }
  if (dest.send) dest.send(msg)
}

export function on(
  proc: ChildProcess,
  type: string,
  callback: (m: any) => void
) {
  function handleMessage(m: any) {
    if (isNodeDevMessage(m) && type in m) callback(m)
  }

  proc.on('internalMessage', handleMessage)
  proc.on('message', handleMessage)
}

export function relay(src: ChildProcess, dest?: any) {
  if (!dest) dest = process
  function relayMessage(m: any) {
    if (isNodeDevMessage(m)) dest.send(m)
  }
  src.on('internalMessage', relayMessage)
  src.on('message', relayMessage)
}
