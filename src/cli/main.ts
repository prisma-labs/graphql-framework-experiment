#!/usr/bin/env node

import { stripIndent } from 'common-tags'
import * as dotenv from 'dotenv'
import * as path from 'path'
import { isError } from 'util'
import { CLI, HelpError } from '../lib/cli'
import * as ExitSystem from '../lib/exit-system'
import { rootLogger } from '../lib/nexus-logger'
import { detectExecLayout, globalLocalHandoff } from '../lib/process'
import * as Commands from './commands'

const log = rootLogger

/**
 *
 */

// use envar to boost perf, skip costly detection work
if (!process.env.GLOBAL_LOCAL_HANDOFF) {
  const depName = 'nexus'
  const execLayout = detectExecLayout({
    depName,
  })

  if (execLayout.toolProject && !execLayout.runningLocalBin) {
    if (execLayout.toolCurrentlyPresentInNodeModules) {
      globalLocalHandoff({
        localPackageDir: path.join(execLayout.project!.nodeModulesDir, depName),
        globalPackageFilename: __filename,
      })
    } else {
      //todo detect package manager
      // const packageManager = await createPackageManager(undefined, { projectRoot })
      log.fatal(
        stripIndent`
        You ran a global version of the Nexus CLI against your Nexus project. But your local project does not currently present within your node_modules.

        Please install your dependencies and then try your command again.

        Location of your global CLI: ${execLayout.thisProcessToolBin.path}
        Location of your local CLI (should be, after installing): ${execLayout.project!.toolBinPath}
        `
      )
      process.exit(1)
    }
  }
}

dotenv.config()
ExitSystem.install()

process.on('uncaughtException', (e) => {
  console.error(e)
  ExitSystem.exit(1)
})

process.on('unhandledRejection', (e) => {
  console.error(e)
  ExitSystem.exit(1)
})

const cli = new CLI({
  dev: new Commands.Dev(),
  build: new Commands.Build(),
  report: new Commands.Report(),
  create: {
    app: new Commands.Create.App(),
    plugin: new Commands.Create.Plugin(),
    __default: 'app',
  },
  __default: new Commands.__Default(),
})

cli
  .parse(process.argv.slice(2))
  .then((result) => {
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
  })
  .then((exitCode) => {
    ExitSystem.exit(exitCode)
  })
