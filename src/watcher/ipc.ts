import * as Net from 'net'
import * as ipc2 from 'node-ipc'
import { rootLogger } from '../utils/logger'

export type NodeIPCServer = typeof ipc2.server

const serverLogger = rootLogger.child('watcher:ipc:server')

type MessageType =
  | 'runner:module_required'
  | 'runner:error'
  | 'runner:app_server_listening'

type MessageStruct<
  Type extends MessageType,
  Data extends Record<string, unknown>
> = {
  type: Type
  data: Data
}

/**
 * This event is sent by the runner when booting up the app.
 *
 * This permits the server to know which files are part of the program. A
 * classic use-case is for the server to watch only files actually part of the
 * program.
 */
type ModuleRequiredMessage = MessageStruct<
  'runner:module_required',
  {
    filePath: string
  }
>

/**
 * This event is sent by the runner when an uncaught error has occured. This
 * error could be from anywhere in the runner process: the user's project code
 * or the runner framework code, etc.
 */
type ErrorMessage = MessageStruct<
  'runner:error',
  {
    error: string
    stack: string | undefined
    /**
     * todo
     */
    willTerminate: boolean
  }
>

type Message = ModuleRequiredMessage | ErrorMessage | AppServerListeningMessage

type AppServerListeningMessage = MessageStruct<
  'runner:app_server_listening',
  {}
>

export namespace client {
  export namespace senders {
    export function moduleImported(data: ModuleRequiredMessage['data']): void {
      const msg: ModuleRequiredMessage = {
        type: 'runner:module_required',
        data,
      }
      ipc2.of.nexus_dev_watcher.emit('message', msg)
    }
    export function error(data: ErrorMessage['data']): void {
      const msg: ErrorMessage = { type: 'runner:error', data }
      ipc2.of.nexus_dev_watcher.emit('message', msg)
    }
  }
}

export type Server = ReturnType<typeof create>

type EventType =
  | 'connect'
  | 'error'
  | 'socket.disconnected'
  | 'disconnect'
  | 'destroy'
  | 'message'

type EventsLookup = {
  connect: [Net.Socket]
  error: []
  'socket.disconnected': [Net.Socket, false | number]
  disconnect: []
  destroy: []
  message: [Message]
}

export function create() {
  ipc2.config.id = 'nexus_dev_watcher'
  // ipc2.config.logger = serverLogger.trace
  ipc2.config.silent = true
  ipc2.serve()
  ipc2.server.start()
  ipc2.server.on('connect', _socket => {
    serverLogger.trace('socket connected')
  })
  ipc2.server.on('disconnect', (...args) => {
    serverLogger.trace('socket disconnected (client sent)', { args })
  })
  ipc2.server.on('destroy', (...args) => {
    serverLogger.trace('socket destroyed (gone for good, no more retries)', {
      args,
    })
  })
  ipc2.server.on('socket.disconnected', (_socket, destroyedSocketId) => {
    serverLogger.trace('socket disconnected (server sent)', {
      destroyedSocketId,
    })
  })

  return {
    on: <E extends EventType>(
      eventType: E,
      observer: (...args: EventsLookup[E]) => void
    ) => {
      ipc2.server.on(eventType, (...args) => {
        serverLogger.trace('inbound event for subscriber', {
          type: eventType,
          args,
        })
        observer(...(args as any))
      })
    },
    // on(event: any, cb: any) {
    //   ipc2.server.on(event, cb)
    // },
    stop(): void {
      ipc2.server.stop()
    },
    async start(): Promise<void> {
      return new Promise((res, rej) => {
        ipc2.server.on('error', rej)
        ipc2.server.on('start', () => {
          serverLogger.trace('started')
          res()
        })
      })
    },
  }
}

// export function on(
//   server: NodeIPCServer,
//   eventType: string,
//   callback: (m: any) => void
// ) {
//   function handleMessage(m: any) {
//     if (isNodeDevMessage(m) && eventType in m) callback(m)
//   }

//   server.on('internalMessage', handleMessage)
//   server.on('message', handleMessage)
// }

// export function relay(src: PTY.IPty, dest?: any) {
//   if (!dest) dest = process
//   function relayMessage(m: any) {
//     if (isNodeDevMessage(m)) dest.send(m)
//   }
//   // src.on('internalMessage', relayMessage)
//   // src.on('message', relayMessage)
// }
