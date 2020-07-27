import chalk from 'chalk'
import { GraphQLError, Source, SourceLocation } from 'graphql'
import stripAnsi from 'strip-ansi'
import { cleanStack } from '../../lib/errors'
import { highlightGraphQL } from '../../lib/errors/stacktrace/highlight'
import { indent } from '../../lib/utils'
import { log } from './logger'

const resolverLogger = log.child('graphql')

export function errorFormatter(graphQLError: GraphQLError) {
  const colorlessMessage = stripAnsi(graphQLError.message)

  if (process.env.NEXUS_STAGE === 'dev') {
    resolverLogger.error(graphQLError.message)

    if (graphQLError.source && graphQLError.locations) {
      console.log(
        '\n' + indent(printSourceLocation(graphQLError.source, graphQLError.locations[0]), 2) + '\n'
      )
      if (graphQLError.extensions?.exception?.stacktrace) {
        console.log(
          chalk.dim(
            cleanStack(graphQLError.extensions.exception.stacktrace.join('\n'), { withoutMessage: true })
          ) + '\n'
        )
      }
    }
  } else {
    graphQLError.message = colorlessMessage
    resolverLogger.error('An exception occurred in one of your resolver', {
      error: {
        ...graphQLError,
      },
    })
  }

  graphQLError.message = colorlessMessage

  return graphQLError
}

/**
 * Render a helpful description of the location in the GraphQL Source document.
 * Modified version from graphql-js
 */
export function printSourceLocation(source: Source, sourceLocation: SourceLocation): string {
  const firstLineColumnOffset = source.locationOffset.column - 1
  const body = whitespace(firstLineColumnOffset) + highlightGraphQL(source.body)

  const lineIndex = sourceLocation.line - 1
  const lineOffset = source.locationOffset.line - 1
  const lineNum = sourceLocation.line + lineOffset

  const columnOffset = sourceLocation.line === 1 ? firstLineColumnOffset : 0
  const columnNum = sourceLocation.column + columnOffset

  const lines = body.split(/\r\n|[\n\r]/g)
  const locationLine = lines[lineIndex]

  //TODO: bring back trimmed formatting later. We cannot break lines at random positions or it breaks the syntax highlighting
  // Special case for minified documents
  // if (locationLine.length > 120) {
  //   const subLineIndex = Math.floor(columnNum / 80)
  //   const subLineColumnNum = columnNum % 80
  //   const subLines = []
  //   for (let i = 0; i < locationLine.length; i += 80) {
  //     subLines.push(locationLine.slice(i, i + 80))
  //   }

  //   return printPrefixedLines([
  //     [`${lineNum}`, subLines[0]],
  //     ...subLines.slice(1, subLineIndex + 1).map((subLine) => ['', subLine]),
  //     [' ', whitespace(subLineColumnNum - 1) + chalk.redBright('^')],
  //     ['', subLines[subLineIndex + 1]],
  //   ])
  // }

  return printPrefixedLines([
    // Lines specified like this: ["prefix", "string"],
    [`${lineNum - 1}`, lines[lineIndex - 1]],
    [`${lineNum}`, locationLine],
    ['', whitespace(columnNum - 1) + chalk.redBright('^')],
    [`${lineNum + 1}`, lines[lineIndex + 1]],
  ])
}

function printPrefixedLines(lines: Array<string[]>): string {
  const existingLines = lines.filter(([_, line]) => line !== undefined)

  const padLen = Math.max(...existingLines.map(([prefix]) => prefix.length))
  return existingLines
    .map(
      ([prefix, line]) =>
        chalk.dim(leftPad(padLen, prefix)) + (line ? chalk.dim(' | ') + line : chalk.dim(' |'))
    )
    .join('\n')
}

function whitespace(len: number): string {
  return Array(len + 1).join(' ')
}

function leftPad(len: number, str: string): string {
  return whitespace(len - str.length) + str
}
