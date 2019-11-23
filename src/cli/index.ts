#!/usr/bin/env ts-node
import { CLI } from './helpers/CLI'
import * as Commands from './commands'
import { HelpError } from './helpers'
import { isError } from 'util'
import chalk from 'chalk'
import { pog } from '../utils'

const log = pog.sub('cli')

process.on('uncaughtException', e => {
  console.error(e)
})

process.on('unhandledRejection', e => {
  console.error(e)
})

process.on('SIGINT', () => {
  log('got SIGINT')
  process.exit(0) // now the "exit" event will fire
})

process.on('SIGTERM', () => {
  log('got SIGTERM')
  process.exit(0) // now the "exit" event will fire
})

// warnings: no tanks
// hides ExperimentalWarning: The fs.promises API is experimental
process.env.NODE_NO_WARNINGS = '1'

/**
 * Main function
 */
async function main(): Promise<number> {
  // react shut up
  process.env.NODE_ENV = 'production'

  // create a new CLI with our subcommands
  const cli = CLI.new({
    dev: new Commands.Dev(),
    build: Commands.Build.new(),
    generate: Commands.Generate.new(),
    doctor: Commands.Doctor.new(),
    init: Commands.Init.new(),
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
