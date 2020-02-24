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

// client

export const client = createClient()

function createClient() {
  return {
    senders: {
      moduleImported(data: ModuleRequiredMessage['data']): void {
        const msg: ModuleRequiredMessage = {
          type: 'module_imported',
          data,
        }
        process.send!(msg)
      },
      error(data: ErrorMessage['data']): void {
        const msg: ErrorMessage = {
          type: 'error',
          data,
        }
        process.send!(msg)
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
        process.send!(msg)
      },
    },
    // connect(): Promise<void> {
    //   if (state.connected) return Promise.resolve()
    //   state.connected = true
    //   return new Promise(res => {
    //     ipc2.connectTo('nexus_dev_watcher', () => {
    //       clientLog.trace('socket created')
    //       ipc2.of.nexus_dev_watcher.on('connect', () => {
    //         clientLog.trace('connection to watcher established')
    //         res()
    //       })
    //     })
    //   })
    // },
  }
}
