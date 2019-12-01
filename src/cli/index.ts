#!/usr/bin/env node
import { CLI } from './helpers/CLI'
import * as Commands from './commands'
import { HelpError } from './helpers'
import { isError } from 'util'
import { pog } from '../utils'

const log = pog.sub('cli')

process.on('uncaughtException', e => {
  console.error(e)
})

process.on('unhandledRejection', e => {
  console.error(e)
})

// HACK
// in dev mode node is put into raw mode so that key presses can be handled so
// that users can switch between log view and ui view.
//
// This in turn affects how sigterm is handled by node––automatic systems are
// turned off such as how node forwards sigterm to child processes.

// In turn this forces us to handle the sigterm manually in dev command. But that is not
// possible with the following block of logic which will cause process exit
// before a clean exit has happened. Dev command needs to kill its runner child
// process.
//
// Overall we need to rethink all of this. The current approach is very error
// prone and barely working and has 0 test coverage.
//
if (!process.argv.join(' ').includes('pumpkins dev')) {
  if (process.argv[1] !== 'dev') {
    process.on('SIGINT', () => {
      log('got SIGINT')
      process.exit(0) // now the "exit" event will fire
    })

    process.on('SIGTERM', () => {
      log('got SIGTERM')
      process.exit(0) // now the "exit" event will fire
    })
  }
} else {
  log('HACK letting dev command handle sigterm/sigint')
}

/**
 * Main function
 */
async function main(): Promise<number> {
  // create a new CLI with our subcommands
  const cli = CLI.new({
    dev: new Commands.Dev(),
    build: new Commands.Build(),
    generate: new Commands.Generate(),
    doctor: new Commands.Doctor(),
    create: new Commands.Create(),
  })

  // parse the arguments
  const result = await cli.parse(process.argv.slice(2))

  if (result instanceof HelpError) {
    console.error(result.message)
    return 1
  } else if (isError(result)) {
    console.error(result)
    return 1
  }

  if (result) {
    console.log(result)
  }

  return 0
}

/**
 * Run our program
 */
main()
