import chalk from 'chalk'

export const logger = {
  error: (...args: string[]) => console.log(chalk.red('ERROR: '), ...args),
  warn: (...args: string[]) => console.log(chalk.yellow('Warning: '), ...args),
}
