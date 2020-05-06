import chalk from 'chalk'
import { stripIndent } from 'common-tags'
import { log } from '../lib/nexus-logger'
import { fatal } from '../lib/process'
import { AppState } from './app'

/**
 * For a the given method that would not work if the app is assembled, log a
 * warning if the app is assembled.
 */
export function assertAppNotAssembled(appState: AppState, methodName: string, message: string) {
  if (appState.assembled) {
    // todo make this fatal in prod
    log.warn(stripIndent`
      Cannot call ${chalk.yellow(methodName)}(...) after app.assemble()

      ${message}
    `)
  }
}

/**
 * For a given property that would not work if the app is _not_ assembled, log
 * and crash if the app is _not_ assembled.
 */
export function assertAppIsAssembledBeforePropAccess(
  appState: AppState,
  methodName: string,
  message?: string
) {
  if (!appState.assembled) {
    let msg = ''

    msg += `Must access ${chalk.yellow(methodName)} after app.assemble()`

    if (message) {
      msg += `\n\n${message}`
    }

    fatal(msg)
  }
}
