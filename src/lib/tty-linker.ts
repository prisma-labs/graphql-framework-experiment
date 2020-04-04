import * as nodecp from 'child_process'
import * as lo from 'lodash'

// Note we found but did not investigate why that importing a log module here
// broke the tty effect of Nexus runner.

interface ServerMessage {
  type: 'tty_resize'
  columns: number
  rows: number
}

function createTTYResizeMessage(): ServerMessage {
  return {
    type: 'tty_resize',
    columns: process.stdout.columns,
    rows: process.stdout.rows,
  }
}

export function create() {
  const cps: nodecp.ChildProcess[] = []
  let forwardingOn = false

  return {
    parent: {
      serialize() {
        if (
          process.stdout.columns === undefined ||
          process.stdout.rows === undefined
        ) {
          throw new Error(
            'Cannot serialize columns and/or rows data for process.stdout because they are undefined. This probably means there is no TTY. Yet an attempt to serialize TTY info is being made.'
          )
        }
        return {
          TTY_COLUMNS: String(process.stdout.columns),
          TTY_ROWS: String(process.stdout.rows),
        }
      },
      forward(cp: nodecp.ChildProcess) {
        // lazy start
        cps.push(cp)

        if (!forwardingOn) {
          forwardingOn = true
          process.stdout.on(
            'resize',
            lo.debounce(
              () => {
                if (process.stdout.isTTY === false) {
                  throw new Error(
                    'Cannot forward process.stdout rows/columns because it has no TTY itself.'
                  )
                }
                for (const cp of cps) {
                  cp.send(createTTYResizeMessage())
                }
              },
              1000,
              {
                trailing: true,
                leading: false,
              }
            )
          )
        }
      },
      unforward(uncp: nodecp.ChildProcess) {
        const i = cps.findIndex((cp) => cp === uncp)
        if (i > -1) {
          cps.splice(i, 1)
        }
      },
    },
    child: {
      install() {
        // yes there is a tty
        require('tty').isatty = (fd: number) => true
        process.stdout.isTTY = true
        process.stderr.isTTY = true

        // bootstrap the rows/columns
        if (process.env.TTY_COLUMNS) {
          const columns = parseInt(process.env.TTY_COLUMNS, 10)
          if (columns !== NaN) {
            process.stdout.columns = columns
          }
        }
        if (process.env.TTY_ROWS) {
          const rows = parseInt(process.env.TTY_ROWS, 10)
          if (rows !== NaN) {
            process.stdout.rows = rows
          }
        }

        // subsribe to row/column changes
        process.on('message', (message) => {
          if (message && message.type === 'tty_resize') {
            process.stdout.rows = message.rows
            process.stdout.columns = message.columns
          }
        })
      },
    },
  }
}
