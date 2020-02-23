#!/usr/bin/env node
import { stripIndent } from 'common-tags'
import * as dotenv from 'dotenv'
import { isError } from 'util'
import * as Layout from '../framework/layout'
import { CLI, HelpError } from '../lib/cli'
import { fatal, isProcessFromProjectBin } from '../utils'
import { log } from '../utils/logger'
import * as PackageManager from '../utils/package-manager'
import * as Commands from './commands'

// Loads env variable from .env file
dotenv.config()

process.on('uncaughtException', e => {
  console.error(e)
  exit(1)
})

process.on('unhandledRejection', e => {
  console.error(e)
  exit(1)
})

type BeforeExiter = () => Promise<unknown>

declare global {
  namespace NodeJS {
    interface Process {
      beforeExiters: BeforeExiter[]
      onBeforeExit(cb: BeforeExiter): void
    }
  }
}

process.once('SIGTERM', () => exit(0))
process.once('SIGINT', () => exit(0))
process.beforeExiters = []
process.onBeforeExit = (cb: BeforeExiter): void => {
  process.beforeExiters.push(cb)
}
let tearingDown = false
async function exit(exitCode: number) {
  log.trace('exiting', { beforeExitersCount: process.beforeExiters.length })
  if (tearingDown) return
  tearingDown = true
  try {
    await Promise.race([
      new Promise(res => {
        // todo send SIGKILL to process tree...
        log.warn('time expired before all before-exit teardowns completed')
        setTimeout(res, 2000)
      }),
      Promise.all(process.beforeExiters.map(f => f())),
    ])
  } catch (e) {
    console.error(e)
    // If exiting with an already already, preserve that
    process.exit(exitCode > 0 ? exitCode : 1)
  }
  process.exit(exitCode)
}

main().then(exitCode => {
  process.exit(exitCode)
})

/**
 * Check that this nexus process is being run from a locally installed
 * veresion unless there is local project or the local project does not have
 * nexus installed.
 */
async function guardNotGlobalCLIWithLocalProject(
  packageManager: PackageManager.PackageManager
): Promise<void> {
  // TODO data is attainable from layout scan calculated later on... not optimal to call this twice...
  const projectType = await Layout.scanProjectType()
  if (
    projectType.type === 'NEXUS_project' &&
    isProcessFromProjectBin(projectType.packageJsonPath)
  ) {
    // TODO make npm aware
    fatal(stripIndent`
        You are using the nexus cli from a location other than this project.

        Location of the nexus CLI you executed:      ${process.argv[1]}
        Location of the nexus CLI for this project:  ${projectType.packageJsonPath +
          '/node_modules/.bin/nexus'}
        
        Please use the nexus CLI for this project:

            ${packageManager.renderRunBin(
              'nexus ' + process.argv.slice(2).join(' ')
            )}
      `)
  }
}

/**
 * Main function
 */
async function main(): Promise<number> {
  const packageManager = await PackageManager.create()
  await guardNotGlobalCLIWithLocalProject(packageManager)

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
    db: {
      init: new Commands.Db.Init(),
      migrate: {
        apply: new Commands.Db.Migrate.Apply(),
        plan: new Commands.Db.Migrate.Plan(),
        rollback: new Commands.Db.Migrate.Rollback(),
        __default: new Commands.Db.Migrate.Default(),
      },
      ui: new Commands.Db.Ui(),
      __default: new Commands.Db.Default(),
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
  } else {
    if (result !== undefined) {
      console.log(result)
    }
    return 0
  }
}
