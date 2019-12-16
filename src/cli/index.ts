#!/usr/bin/env node
import { CLI } from './helpers/CLI'
import * as Commands from './commands'
import { HelpError } from './helpers'
import { isError } from 'util'
import { pog, fatal } from '../utils'
import * as Layout from '../framework/layout'
import * as Path from 'path'
import { stripIndent } from 'common-tags'

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

async function guardNotGlobalPumpkinsWithLocalPumpkinsProject(): Promise<void> {
  // TODO data is attainable from layout scan calculated later on... not optimal to call this twice...
  const projectType = await Layout.scanProjectType()
  if (projectType.type === 'pumpkins_project') {
    const pumpkinsBinPath = process.argv[1]
    const pumpkinsBinDirPath = Path.dirname(pumpkinsBinPath)
    const packageJsonPath = Path.dirname(projectType.packageJsonPath)
    const projectBinDirPath = Path.join(packageJsonPath, 'node_modules/.bin')
    if (pumpkinsBinDirPath !== projectBinDirPath) {
      // TODO make npm aware
      fatal(stripIndent`
        You are using the pumpkins cli from a globally installed location. Please use the locally installed one:

            yarn pumpkins ${process.argv.slice(2)}
      `)
    }
  }
}

/**
 * Main function
 */
async function main(): Promise<number> {
  await guardNotGlobalPumpkinsWithLocalPumpkinsProject()

  // create a new CLI with our subcommands
  const cli = new CLI({
    dev: new Commands.Dev(),
    build: new Commands.Build(),
    generate: new Commands.Generate(),
    doctor: new Commands.Doctor(),
    create: {
      app: new Commands.Create.App(),
      plugin: new Commands.Create.Plugin(),
      __default: 'app',
    },
    __default: new Commands.__Default(),
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
