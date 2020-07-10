import chalk from 'chalk'
import * as fs from 'fs-jetpack'
import * as os from 'os'
import * as path from 'path'
import * as stackTraceParser from 'stacktrace-parser'
import { highlightTS } from './highlight'

export interface ErrorArgs {
  /**
   * Stack of the error
   */
  callsite: string | undefined
}

export interface PrintStackResult {
  /**
   * Portion of the file where the error happened
   */
  preview: string | null
  /**
   * Name of the method that caused the error
   */
  methodName: string | null
  /**
   * Information about the user file where the error happened
   */
  file: {
    /**
     * File path where the error happened
     */
    path: string | null
    /**
     * File path where the error happened, including the location
     */
    pathLineNumber: string | null
    /**
     * File path where the error happened, relative to the user home directory
     */
    pathRelToHomeDir: string | null
  }
}

const schemaRegex = /(\S+(objectType|inputObjectType|interfaceType|unionType|enumType|queryType|mutationType|subscriptionType|extendType|scalarType|importType|)\()/

export const printStack = ({ callsite }: ErrorArgs): PrintStackResult => {
  let fileLineNumber: string | null = null
  let filePreview: string | null = null
  let filePath: string | null = null
  let filePathRelToHomeDir: string | null = null
  let methodName: string | null = null

  // @ts-ignore
  if (callsite && typeof window === 'undefined') {
    const stack = stackTraceParser.parse(callsite)

    // TODO: more resilient logic to find the right trace
    const trace = stack.find(
      (t) =>
        t.file &&
        !t.file.includes('node_modules/nexus') &&
        !t.file.includes('node_modules/@nexus/schema') &&
        !t.file.includes('node_modules/graphql')
    )
    if (
      process.env.NEXUS_STAGE === 'dev' &&
      trace &&
      trace.file &&
      trace.lineNumber &&
      trace.column &&
      !trace.file.startsWith('internal/')
    ) {
      const lineNumber = trace.lineNumber
      const projectRoot = getProjectRoot()
      const tracePathRelToProjectRoot = projectRoot ? path.relative(projectRoot, trace.file) : trace.file
      const tracePathRelToHomeDir = trace.file.replace(os.homedir(), '~')

      fileLineNumber = callsite
        ? `${chalk.underline(`${tracePathRelToProjectRoot}:${lineNumber}:${trace.column}`)}`
        : ''
      if (fs.exists(trace.file)) {
        const fileContent = fs.read(trace.file) as string
        const splitFile = fileContent.split('\n')
        const start = Math.max(0, lineNumber - 3)
        const end = Math.min(lineNumber + 3, splitFile.length - 1)
        const lines = splitFile.slice(start, end)
        const theLine = lines[2]

        const match = theLine.match(schemaRegex)
        if (match) {
          methodName = `${match[1]})`
        }

        const highlightedLines = highlightTS(lines.join('\n')).split('\n')
        filePreview = highlightedLines
          .map((l, i) => chalk.grey(renderN(i + start + 1, lineNumber + start + 1) + ' ') + chalk.reset() + l)
          .map((l, i, _arr) =>
            i === 2
              ? `${chalk.red.bold('→')} ${l} ${chalk.dim(
                  `${tracePathRelToHomeDir}:${lineNumber}:${trace.column}`
                )}`
              : chalk.dim('  ' + l)
          )
          .join('\n')
        filePath = trace.file
        filePathRelToHomeDir = tracePathRelToHomeDir
      }
    }
  }

  return {
    preview: filePreview ? `${filePreview}${chalk.reset()}` : null,
    methodName,
    file: {
      path: filePath,
      pathLineNumber: fileLineNumber,
      pathRelToHomeDir: filePathRelToHomeDir,
    },
  }
}

function renderN(n: number, max: number): string {
  const wantedLetters = String(max).length
  const hasLetters = String(n).length
  if (hasLetters >= wantedLetters) {
    return String(n)
  }

  return String(' '.repeat(wantedLetters - hasLetters) + n)
}

/**
 * Stack overflow reference: https://stackoverflow.com/a/43960876
 */
export function getProjectRoot(): string | null {
  return process?.mainModule?.paths[0].split('node_modules')[0].slice(0, -1) ?? null
}
