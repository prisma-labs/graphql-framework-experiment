import chalk from 'chalk'

/**
 * Borrowed from 'log-symbols'
 * Check out 'figures' for more symbols
 */
const isSupported =
  process.platform !== 'win32' ||
  process.env.CI ||
  process.env.TERM === 'xterm-256color'

const main = {
  info: 'ℹ',
  success: '✔',
  warning: '⚠',
  error: '✖',
}

const fallbacks = {
  info: 'i',
  success: '√',
  warning: '‼',
  error: '×',
}

const symbols = isSupported ? main : fallbacks

export const logger = {
  error: (format: string, ...vars: unknown[]): void =>
    console.log(chalk.red(symbols.error, ' ') + format, ...vars),
  errorBold: (format: string, ...vars: unknown[]): void =>
    console.log(chalk.red(symbols.error, ' ') + chalk.bold(format), ...vars),
  warn: (format: string, ...vars: unknown[]): void =>
    console.log(chalk.yellow(symbols.warning, ' ') + format, ...vars),
  info: (format: string, ...vars: unknown[]): void =>
    console.log(chalk.blue(symbols.info, ' ') + format, ...vars),
  success: (format: string, ...vars: unknown[]): void =>
    console.log(chalk.green(`${symbols.success} `) + format, ...vars),
  successBold: (format: string, ...vars: unknown[]): void =>
    console.log(
      chalk.green(`${symbols.success} `) + chalk.bold(format),
      ...vars
    ),
}
