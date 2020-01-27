#!/usr/bin/env node
import { stripIndent } from 'common-tags'
import * as dotenv from 'dotenv'
import { isError } from 'util'
import * as Layout from '../framework/layout'
import { CLI, HelpError } from '../lib/cli'
import { fatal, isProcessFromProjectBin } from '../utils'
import * as PackageManager from '../utils/package-manager'
import * as Commands from './commands'

// Loads env variable from .env file
dotenv.config()

process.on('uncaughtException', e => {
  console.error(e)
})

process.on('unhandledRejection', e => {
  console.error(e)
})

main().then(exitCode => {
  process.exit(exitCode)
})

/**
 * Check that this nexus-future process is being run from a locally installed
 * veresion unless there is local project or the local project does not have
 * nexus-future installed.
 */
async function guardNotGlobalCLIWithLocalProject(
  packageManager: PackageManager.PackageManager
): Promise<void> {
  // TODO data is attainable from layout scan calculated later on... not optimal to call this twice...
  const projectType = await Layout.scanProjectType()
  if (
    projectType.type === 'NEXUS_FUTURE_project' &&
    isProcessFromProjectBin(projectType.packageJsonPath)
  ) {
    // TODO make npm aware
    fatal(stripIndent`
        You are using the nexus-future cli from a location other than this project.

        Location of the nexus-future CLI you executed:      ${process.argv[1]}
        Location of the nexus-future CLI for this project:  ${projectType.packageJsonPath +
          '/node_modules/.bin/nexus-future'}
        
        Please use the nexus-future CLI for this project:

            ${packageManager.renderRunBin(
              'nexus-future ' + process.argv.slice(2).join(' ')
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
