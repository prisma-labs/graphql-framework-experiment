import chalk, { Chalk } from 'chalk'
import stripAnsi from 'strip-ansi'
import * as util from 'util'
import * as utils from '../utils'
import * as Level from './level'
import * as Logger from './logger'

// Helpful unicode pickers:
// - https://jrgraphix.net/r/Unicode/2600-26FF
// - https://graphemica.com/

const LEVEL_STYLES: Record<
  Level.Level,
  { badge: string; color: chalk.Chalk }
> = {
  fatal: {
    // badge: '⚰',
    // badge: '☠',
    badge: '✕',
    color: chalk.red,
  },
  error: {
    badge: '■',
    color: chalk.red,
  },
  warn: {
    badge: '▲',
    color: chalk.yellow,
  },
  info: {
    // badge: '↣',
    badge: '●',
    color: chalk.green,
  },
  debug: {
    // badge: '◒',
    badge: '○',

    // badge: '⚒',
    // badge: '↺',
    // badge: '↯',
    // badge: '⟐',
    color: chalk.blue,
  },
  trace: {
    badge: '—',
    // badge: '~',
    // badge: '⟣',
    // badge: '⟛',
    // badge: '⠿',
    color: chalk.magenta,
  },
}

const pathSep = {
  symbol: ':',
  color: chalk.gray,
}

const eventSep = ':'

const contextSep = {
  singleLine: {
    symbol: ' --  ',
    // context = ` ${chalk.gray('⸬')}  ` + context
    // context = ` ${chalk.gray('•')}  ` + context
    // context = ` ${chalk.gray('⑊')}  ` + context
    // context = ` ${chalk.gray('//')}  ` + context
    // context = ` ${chalk.gray('—')}  ` + context
    // context = ` ${chalk.gray('~')}  ` + context
    // context = ` ${chalk.gray('⌀')}  ` + context
    // context = ` ${chalk.gray('——')}  ` + context
    // context = ` ${chalk.gray('❯')}  ` + context
    // context = ` ${chalk.gray('->')}  ` + context
    // context = ` ${chalk.gray('⌁')}  ` + context
    // context = ` ${chalk.gray('⋯')}  ` + context
    // context = ` ${chalk.gray('⌁')}  ` + context
    // context = ` ${chalk.gray('⟛')}  ` + context
    color: chalk.gray,
  },
  multiline: {
    symbol: '',
  },
}

const contextKeyValSep = {
  singleLine: {
    symbol: ': ',
    color: chalk.gray,
  },
  multiline: {
    symbol: '  ',
  },
}

const contextEntrySep = {
  singleLine: '  ',
  multiline: {
    symbol: `\n  | `,
    color: chalk.gray,
  },
}

type Options = {
  levelLabel: boolean
}

export function create(options: Options) {
  return render.bind(null, options)
}

export function render(options: Options, rec: Logger.LogRecord): string {
  const levelLabel = Level.LEVELS_BY_NUM[rec.level].label
  const style = LEVEL_STYLES[levelLabel]

  // render pre-context

  const levelLabelRendered = options.levelLabel
    ? ' ' + utils.spanSpace(5, levelLabel) + ' '
    : ' '
  const path = rec.path.join(renderEl(pathSep))

  const renderedPreContext = `${style.color(
    `${style.badge}${levelLabelRendered}${path}`
  )}${chalk.gray(eventSep)}${rec.event}`

  // render context

  const availableContextColumns =
    process.stdout.columns - stripAnsi(renderedPreContext).length
  let contextColumnsConsumed = 0

  const contextEntries = Object.entries(rec.context)
  let widestKey = 0

  const contextEntriesRendered = contextEntries.map(([key, value]) => {
    contextColumnsConsumed +=
      key.length + contextKeyValSep.singleLine.symbol.length
    if (key.length > widestKey) widestKey = key.length

    const valueRendered = `${util.inspect(value, {
      breakLength: availableContextColumns,
      colors: true,
      getters: true,
      depth: 20,
    })}`

    contextColumnsConsumed += stripAnsi(valueRendered).length

    return [key, valueRendered]
  })

  const contextFitsSingleLine =
    contextColumnsConsumed <= availableContextColumns

  let contextRendered = ''
  if (contextEntries.length > 0) {
    if (contextFitsSingleLine) {
      contextRendered =
        renderEl(contextSep.singleLine) +
        contextEntriesRendered
          .map(
            ([key, value]) =>
              `${chalk.gray(key)}${renderEl(
                contextKeyValSep.singleLine
              )}${value}`
          )
          .join(contextEntrySep.singleLine)
    } else {
      contextRendered =
        renderEl(contextSep.multiline) +
        renderEl(contextEntrySep.multiline) +
        contextEntriesRendered
          .map(
            ([key, value]) =>
              `${chalk.gray(utils.spanSpace(widestKey, key))}${renderEl(
                contextKeyValSep.multiline
              )}${indentBlockTail(
                widestKey +
                  contextKeyValSep.multiline.symbol.length +
                  contextEntrySep.multiline.symbol.length,
                value
              )}`
          )
          .join(renderEl(contextEntrySep.multiline))
    }
  }

  // put it together

  return `${renderedPreContext} ${contextRendered}\n`
}

type El = {
  symbol: string
  color?: Chalk
}

function renderEl(el: El) {
  return el.color ? el.color(el.symbol) : el.symbol
}

/**
 * Indent a string that spans multiple lines except for the first line.
 */
function indentBlockTail(size: number, block: string): string {
  // TODO optimize!!!!!
  const [first, ...rest] = block.split('\n')
  if (rest.length === 0) return first
  return first + '\n' + indentBlock(size, rest.join('\n'))
}

/**
 * Indent a string that spans multiple lines.
 */
function indentBlock(size: number, block: string): string {
  return block
    .split('\n')
    .map(
      line =>
        range(size)
          .map(constant(' '))
          .join('') + line
    )
    .join('\n')
}

/**
 * Create a function that will only ever return the given value when called.
 */
const constant = <T>(x: T): (() => T) => {
  return function() {
    return x
  }
}

/**
 * Create a range of integers.
 */
const range = (times: number): number[] => {
  const list: number[] = []
  while (list.length < times) {
    list.push(list.length + 1)
  }
  return list
}
