#!/usr/bin/env node

import { stripIndent } from 'common-tags'
import * as dotenv from 'dotenv'
import * as Path from 'path'
import { isError } from 'util'
import { CLI, HelpError } from '../lib/cli'
import * as ExitSystem from '../lib/exit-system'
import * as Layout from '../lib/layout'
import * as PackageManager from '../lib/package-manager'
import { fatal, isProcessFromProjectBin } from '../lib/process'
import * as Commands from './commands'

dotenv.config()
ExitSystem.install()

process.on('uncaughtException', e => {
  console.error(e)
  ExitSystem.exit(1)
})

process.on('unhandledRejection', e => {
  console.error(e)
  ExitSystem.exit(1)
})

main().then(exitCode => {
  ExitSystem.exit(exitCode)
})

/**
 * Check that this nexus process is being run from a locally installed
 * version unless there is no local project or the local project does not have
 * nexus installed.
 */
async function guardNotGlobalCLIWithLocalProject(
  packageManager: PackageManager.PackageManager
): Promise<void> {
  // TODO data is attainable from layout scan calculated later on... not optimal to call this twice...
  const projectType = await Layout.scanProjectType({ cwd: process.cwd() })

  if (
    projectType.type === 'NEXUS_project' &&
    isProcessFromProjectBin(projectType.packageJsonLocation.path)
  ) {
    // TODO make npm aware
    fatal(stripIndent`
        You are using the nexus cli from a location other than this project.

        Location of the nexus CLI you executed:      ${process.argv[1]}
        Location of the nexus CLI for this project:  ${Path.join(
          projectType.packageJsonLocation.dir,
          'node_modules',
          '.bin',
          'nexus'
        )}
        
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
  const packageManager = await PackageManager.create(undefined, {
    projectRoot: process.cwd(),
  })
  await guardNotGlobalCLIWithLocalProject(packageManager)

  // create a new CLI with our subcommands
  const cli = new CLI({
    dev: new Commands.Dev(),
    build: new Commands.Build(),
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
  } else {
    if (result !== undefined) {
      console.log(result)
    }
    return 0
  }
}
