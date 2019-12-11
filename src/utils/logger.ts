import chalk from 'chalk'

export const logger = {
  error: (format: string, ...vars: unknown[]): void =>
    console.log(chalk.red('ERROR: ') + format, ...vars),
  warn: (format: string, ...vars: unknown[]): void =>
    console.log(chalk.yellow('WARN: ') + format, ...vars),
  info: (format: string, ...vars: unknown[]): void =>
    console.log(chalk.bgBlue('INFO: ') + format, ...vars),
}
