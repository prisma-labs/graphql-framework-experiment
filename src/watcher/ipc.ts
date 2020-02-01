import * as Net from 'net'
import * as ipc2 from 'node-ipc'

type NodeIPCServer = typeof ipc2.server

/**
 * Checks if the given message is an internal node-dev message.
 */
function isNodeDevMessage(m: any) {
  return m.cmd === 'NODE_DEV'
}

/**
 * Sends a message to the given process.
 */
export function send(msg: any, dest: Net.Socket) {
  msg.cmd = 'NODE_DEV'
  dest.emit('message', msg)
}

export function on(
  server: NodeIPCServer,
  eventType: string,
  callback: (m: any) => void
) {
  function handleMessage(m: any) {
    if (isNodeDevMessage(m) && eventType in m) callback(m)
  }

  server.on('internalMessage', handleMessage)
  server.on('message', handleMessage)
}

// export function relay(src: PTY.IPty, dest?: any) {
//   if (!dest) dest = process
//   function relayMessage(m: any) {
//     if (isNodeDevMessage(m)) dest.send(m)
//   }
//   // src.on('internalMessage', relayMessage)
//   // src.on('message', relayMessage)
// }
