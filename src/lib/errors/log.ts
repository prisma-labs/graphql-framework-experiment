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
    const { preview, methodName, file } = printStack({
      callsite: err.stack,
    })

    const methodNameMessage = methodName ? `on \`${highlightTS(methodName)}\` ` : ''
    const atMessage = file.pathLineNumber ? `at ${file.pathLineNumber}` : ''
    log[level](`${err.message} ${methodNameMessage}${atMessage}`)
    if (err.stack) {
      const cleanedStack = cleanStack(err.stack, { withoutMessage: true }).split('\n').slice(1)
      const renderedStack = [indent('Stack:', 2), ...cleanedStack]
        .map((s) => {
          // Highlight the line of the stack trace were the error happened in the user project
          if (file.pathRelToHomeDir && s.includes(file.pathRelToHomeDir)) {
            return chalk.bold(chalk.redBright(s))
          }

          return s
        })
        .join('\n')

      const filePreviewContent = preview ? `${indent(preview, 2)}\n\n` : ''
      console.log('\n' + filePreviewContent + chalk.dim(renderedStack) + '\n')
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
