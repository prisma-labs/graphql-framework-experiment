import chalk from 'chalk'
import * as Logger from './main'

// Helpful unicode pickers:
// - https://jrgraphix.net/r/Unicode/2600-26FF
// - http://www.btitze.net/ucp/
// - https://apps.timwhitlock.info/emoji/tables/unicode

const LEVEL_STYLES: Record<
  Logger.Level,
  { badge: string; color: chalk.Chalk }
> = {
  fatal: {
    badge: '☠',
    color: chalk.red,
  },
  error: {
    badge: '✕',
    color: chalk.red,
  },
  warn: {
    badge: '▲',
    color: chalk.yellow,
  },
  info: {
    badge: '↣',
    color: chalk.green,
  },
  debug: {
    badge: '⌁',
    color: chalk.blue,
  },
  trace: {
    badge: '⎌',
    color: chalk.magenta,
  },
}

export function render(rec: Logger.LogRecord): string {
  const levelLabel = Logger.LEVELS_BY_NUM[rec.level].label
  const path = rec.path.join('.')
  let context = Object.entries(rec.context)
    .map(e => `${e[0]}${chalk.gray('=')}${e[1]}`)
    .join('  ')
  if (context) {
    context = ` ${chalk.gray('--')}  ` + context
  }
  const style = LEVEL_STYLES[levelLabel]
  return `${style.color(
    `${style.badge} ${spaceSuffixSpan5(levelLabel)} ${path}`
  )}${chalk.gray(':')}${rec.event} ${context}\n`
}

function spaceSuffixSpan5(content: string): string {
  return span('padAfter', ' ', 5, content)
}

function span(
  padSide: 'padBefore' | 'padAfter',
  padChar: string,
  target: number,
  content: string
): string {
  if (content.length > target) {
    return content.slice(0, target)
  }
  let toPadSize = target - content.length
  while (toPadSize > 0) {
    if (padSide === 'padAfter') {
      content = content + padChar
    } else if (padSide === 'padBefore') {
      content = padChar + content
    }
    toPadSize--
  }
  return content
}
