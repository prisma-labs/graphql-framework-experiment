import chalk from 'chalk'
import * as fs from 'fs-jetpack'
import * as stackTraceParser from 'stacktrace-parser'
import { highlightTS } from './highlight'
import * as os from 'os'

function renderN(n: number, max: number): string {
  const wantedLetters = String(max).length
  const hasLetters = String(n).length
  if (hasLetters >= wantedLetters) {
    return String(n)
  }

  return String(' '.repeat(wantedLetters - hasLetters) + n)
}

export interface ErrorArgs {
  callsite: string | undefined
}

export interface PrintStackResult {
  stack: string
  fileLineNumber: string
  methodName: string | null
}

const schemaRegex = /(\S+(objectType|inputObjectType|interfaceType|unionType|enumType|queryType|mutationType|subscriptionType|extendType|scalarType|importType|)\()/

export const printStack = ({ callsite }: ErrorArgs): PrintStackResult => {
  let fileLineNumber = ':'
  let prevLines = '\n'
  let methodName: string | null = null

  // @ts-ignore
  if (callsite && typeof window === 'undefined') {
    const stack = stackTraceParser.parse(callsite)
    // TODO: more resilient logic to find the right trace
    // TODO: should not have hard-coded knowledge of prisma here
    const trace = stack.find((t) => t.file && !t.file.includes('node_modules/nexus'))
    if (
      process.env.NEXUS_STAGE === 'dev' &&
      trace &&
      trace.file &&
      trace.lineNumber &&
      trace.column &&
      !trace.file.startsWith('internal/')
    ) {
      const lineNumber = trace.lineNumber
      fileLineNumber = callsite
        ? `${chalk.underline(`${trace.file.replace(os.homedir(), '~')}:${lineNumber}:${trace.column}`)}`
        : ''
      if (fs.exists(trace.file)) {
        const file = fs.read(trace.file) as string
        const splitFile = file.split('\n')
        const start = Math.max(0, lineNumber - 3)
        const end = Math.min(lineNumber + 3, splitFile.length - 1)
        const lines = splitFile.slice(start, end)
        const theLine = lines[2]

        const match = theLine.match(schemaRegex)
        if (match) {
          methodName = `${match[1]})`
        }

        const highlightedLines = highlightTS(lines.join('\n')).split('\n')
        prevLines = highlightedLines
          .map((l, i) => chalk.grey(renderN(i + start + 1, lineNumber + start + 1) + ' ') + chalk.reset() + l)
          .map((l, i, _arr) => (i === 2 ? `${chalk.red.bold('→')} ${l}` : chalk.dim('  ' + l)))
          .join('\n')
      }
    }
  }

  const stackStr = `${prevLines}${chalk.reset()}`
  return {
    stack: stackStr,
    fileLineNumber,
    methodName,
  }
}
