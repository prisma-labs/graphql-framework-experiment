import Arg from 'arg'
import chalk from 'chalk'
import { stripIndent } from 'common-tags'

/**
 * format
 */
export function format(input: string = ''): string {
  return stripIndent(input).trimRight() + '\n'
}

/**
 * Wrap arg to return an error instead of throwing
 */
export function arg<T extends Arg.Spec>(
  argv: string[],
  spec: T
): Arg.Result<T> | Error {
  try {
    return Arg(spec, { argv, stopAtPositional: true })
  } catch (err) {
    return err
  }
}

/**
 * Check if result is an error
 */
export function isError(result: any): result is Error {
  return result instanceof Error
}

export function generateHelpForCommandIndex(
  commandName: string,
  subCommands: { name: string; description: string }[]
): string {
  const maxSubCommandNameLength = Math.max(
    ...subCommands.map(s => s.name.length)
  )

  return `
${chalk.bold('Usage:')}
    
${chalk.gray('$')} graphql-santa ${commandName} [${subCommands
    .map(c => c.name)
    .join('|')}]

${chalk.bold('Commands:')}

${subCommands
  .map(c => `  ${c.name.padEnd(maxSubCommandNameLength)}  ${c.description}`)
  .join('\n')}
  `
}

export function generateHelpForCommand(
  commandName: string,
  description: string,
  options: { name: string; alias?: string; description: string }[]
): string {
  const optionsWithHelp = [
    ...options,
    { name: 'help', alias: 'h', description: 'Prompt this helper' },
  ]

  return `
${description}

${chalk.bold('Usage:')}
    
${chalk.gray('$')} graphql-santa ${commandName} [options]

${chalk.bold('Options:')}

${optionsWithHelp
  .map(c => `  --${c.name}${c.alias ? `, -${c.alias}` : ''}   ${c.description}`)
  .join('\n')}
  `
}
