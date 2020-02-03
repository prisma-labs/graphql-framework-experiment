import * as Net from 'net'
import * as ipc2 from 'node-ipc'
import { rootLogger } from '../utils/logger'

export type NodeIPCServer = typeof ipc2.server

const serverLog = rootLogger.child('watcher:ipc:server')

type MessageType = 'module_imported' | 'error' | 'app_server_listening'

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
  'module_imported',
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
  'error',
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

type AppServerListeningMessage = MessageStruct<'app_server_listening', {}>

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
    serverLog.trace('socket connected')
  })
  ipc2.server.on('disconnect', (...args) => {
    serverLog.trace('socket disconnected (client sent)', { args })
  })
  ipc2.server.on('destroy', (...args) => {
    serverLog.trace('socket destroyed (gone for good, no more retries)', {
      args,
    })
  })
  ipc2.server.on('socket.disconnected', (_socket, destroyedSocketId) => {
    serverLog.trace('socket disconnected (server sent)', {
      destroyedSocketId,
    })
  })

  const api = {
    on: <E extends EventType>(
      eventType: E,
      observer: (...args: EventsLookup[E]) => void
    ): void => {
      ipc2.server.on(eventType, observer as any)
    },
    stop(): void {
      ipc2.server.stop()
    },
    async start(): Promise<void> {
      return new Promise((res, rej) => {
        ipc2.server.on('error', rej)
        ipc2.server.on('start', () => {
          serverLog.trace('started')
          res()
        })
      })
    },
  }

  api.on('message', message => {
    if (message.type === 'module_imported') return // too noisy...
    serverLog.trace('inbound message', message)
  })

  return api
}

// client

const clientLog = rootLogger.child('watcher:ipc:server')

export const client = createClient()

function createClient() {
  const state = {
    connected: false,
  }

  ipc2.config.id = 'nexus_dev_runner'
  ipc2.config.logger = clientLog.trace
  ipc2.config.silent = true

  return {
    senders: {
      moduleImported(data: ModuleRequiredMessage['data']): void {
        const msg: ModuleRequiredMessage = {
          type: 'module_imported',
          data,
        }
        ipc2.of.nexus_dev_watcher.emit('message', msg)
      },
      error(data: ErrorMessage['data']): void {
        const msg: ErrorMessage = {
          type: 'error',
          data,
        }
        ipc2.of.nexus_dev_watcher.emit('message', msg)
      },
      /**
       * Send a signal that lets dev-mode master know that server is booted and thus
       * ready to receive requests.
       */
      serverListening(): void {
        const msg: Message = {
          type: 'app_server_listening',
          data: {},
        }
        ipc2.of.nexus_dev_watcher.emit('message', msg)
      },
    },
    connect(): Promise<void> {
      if (state.connected) return Promise.resolve()
      state.connected = true
      return new Promise(res => {
        ipc2.connectTo('nexus_dev_watcher', () => {
          clientLog.trace('socket created')
          ipc2.of.nexus_dev_watcher.on('connect', () => {
            clientLog.trace('connection to watcher established')
            res()
          })
        })
      })
    },
  }
}
