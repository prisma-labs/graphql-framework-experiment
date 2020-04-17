#!/usr/bin/env node

import * as dotenv from 'dotenv'
import * as path from 'path'
import { isError } from 'util'
import { CLI, HelpError } from '../lib/cli'
import * as ExitSystem from '../lib/exit-system'
import { detectExecLayout, globalLocalHandoff } from '../lib/process'
import * as Commands from './commands'

// use envar to boost perf, skip costly detection work
if (!process.env.GLOBAL_LOCAL_HANDOFF) {
  const execLayout = detectExecLayout({
    binName: 'nexus',
    depName: 'nexus',
  })

  if (!execLayout.runningLocalBin) {
    if (execLayout.toolCurrentlyPresentInNodeModules) {
      globalLocalHandoff({
        localPackageDir: path.join(execLayout.paths.projectDir!, 'node_modules', 'nexus'),
        globalPackageFilename: __filename,
      })
    } else {
      // todo tell user they are running global nexus and local vesion is not
      // available to handoff too
      // todo tell user this is for their safety, so that they run the framework
      // code that they expect
      // todo tell user to run npm/yarn install
      // todo tell user to re-run their cmd npm/yarn <whatever user ran>
      // const packageManager = await createPackageManager(undefined, { projectRoot })
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
