import * as Logger from '@nexus/logger'
import chalk from 'chalk'
import { indent } from '../utils'
import { cleanStack } from './stacktrace/clean'
import { highlightTS } from './stacktrace/highlight'
import { printStack } from './stacktrace/print-stack'

export function logPrettyError(log: Logger.Logger, err: Error, level: 'fatal'): never
export function logPrettyError(log: Logger.Logger, err: Error, level: 'error'): void
export function logPrettyError(log: Logger.Logger, err: Error, level: 'error' | 'fatal' = 'error'): void {
  if (process.env.NEXUS_STAGE === 'dev') {
    const { stack, fileLineNumber, methodName } = printStack({ callsite: err.stack })

    log[level](`${err.message} ${methodName ? `on \`${highlightTS(methodName)}\` ` : ''}at ${fileLineNumber}`)
    if (err.stack) {
      const cleanedStack = cleanStack(err.stack, { withoutMessage: true }).split('\n').slice(1)
      const renderedStack = [indent('Stack:', 2), ...cleanedStack].join('\n')

      console.log('\n' + indent(stack, 2) + '\n\n' + chalk.dim(renderedStack) + '\n')
    }
  } else {
    log[level](err.message, {
      error: { ...err, stack: cleanStack(err.stack ?? '') },
    })
  }

  if (level === 'fatal') {
    process.exit(1)
  }
}
