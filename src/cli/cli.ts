import * as dotenv from 'dotenv'
import { isError } from 'util'
import { CLI, HelpError } from '../lib/cli'
import * as ExitSystem from '../lib/exit-system'
import * as Commands from './commands'

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