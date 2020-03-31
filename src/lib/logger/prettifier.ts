import stripAnsi from 'strip-ansi'
import * as util from 'util'
import * as utils from '../utils'
import { Chalk, chalk } from './chalk'
import * as Level from './level'
import * as Logger from './logger'

const stopWatch = createStopWatch()

// Helpful unicode pickers:
// - https://jrgraphix.net/r/Unicode/2600-26FF
// - https://graphemica.com/

const LEVEL_STYLES: Record<Level.Level, { badge: string; color: Chalk }> = {
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

export const separators = {
  path: {
    symbol: ':',
  },
  event: {
    symbol: ' ',
  },
  context: {
    singleLine: {
      symbol: '  --  ',
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
  },
  contextKeyVal: {
    singleLine: {
      symbol: ': ',
      color: chalk.gray,
    },
    multiline: {
      symbol: '  ',
    },
  },
  contextEntry: {
    singleLine: '  ',
    multiline: (gutterSpace: string) => ({
      symbol: gutterSpace + `| `,
      color: chalk.gray,
    }),
  },
}

type Options = {
  levelLabel: boolean
  timeDiff: boolean
}

export function create(options: Options) {
  return render.bind(null, options)
}

export function render(opts: Options, logRecord: Logger.LogRecord): string {
  const terminalWidth = process.stdout.columns ?? 80
  const levelLabel = Level.LEVELS_BY_NUM[logRecord.level].label
  const style = LEVEL_STYLES[levelLabel]

  //
  // render time diff
  //

  let timeDiff = ''
  let timeDiffRendered = ''
  if (opts.timeDiff) {
    let elapsedTime = stopWatch.lap()
    let unit: 'ms' | 's' | 'm' | 'h' | 'd' | 'max'
    // <10s
    if (elapsedTime < 1000 * 10) {
      unit = 'ms'
      // 10s-100s (exclusive)
    } else if (elapsedTime >= 1000 * 10 && elapsedTime < 1000 * 100) {
      elapsedTime = Math.round(elapsedTime / 1000)
      unit = 's'
      // 100s-60m (exclusive)
    } else if (elapsedTime >= 1000 * 100 && elapsedTime < 1000 * 60 * 60) {
      elapsedTime = Math.round(elapsedTime / 1000 / 60)
      unit = 'm'
      // 1h-24h (exclusive)
    } else if (
      elapsedTime >= 1000 * 60 * 60 &&
      elapsedTime < 1000 * 60 * 60 * 24
    ) {
      elapsedTime = Math.round(elapsedTime / 1000 / 60 / 60)
      unit = 'h'
      // 1d-999d (exclusive)
    } else if (
      elapsedTime >= 1000 * 60 * 60 &&
      elapsedTime < 1000 * 60 * 60 * 24
    ) {
      elapsedTime = Math.round(elapsedTime / 1000 / 60 / 60 / 24)
      unit = 'd'
    } else {
      unit = 'max'
    }

    if (unit === 'ms') {
      timeDiff = `${utils.spanSpaceRight(4, String(elapsedTime))} `
    } else if (unit === 'max') {
      timeDiff = ' ∞ '
    } else {
      timeDiff = `${unit} ${utils.spanSpaceRight(2, String(elapsedTime))} `
    }
    timeDiffRendered = chalk.gray(timeDiff)
  }

  //
  // render gutter
  //

  const levelLabelSized = opts.levelLabel
    ? ' ' + utils.clampSpace(5, levelLabel) + ' '
    : ' '

  const gutterRendered = `${timeDiffRendered}${style.color(
    `${style.badge}${levelLabelSized}`
  )}`

  // pre-emptyive measurement for potential multiline context indentation later on
  const gutterWidth =
    timeDiff.length + style.badge.length + levelLabelSized.length

  //
  // render pre-context
  //

  const path = logRecord.path.join(renderEl(separators.path))
  const preContextWidth =
    path.length + separators.event.symbol.length + logRecord.event.length
  const preContextRendered =
    style.color(path) + renderEl(separators.event) + logRecord.event

  //
  // render context
  //

  // Factor in:
  // 1. the headers section
  // 2. the headers/context separator
  const availableSinglelineContextColumns =
    terminalWidth -
    gutterWidth -
    preContextWidth -
    separators.context.singleLine.symbol.length
  let contextColumnsConsumed = 0

  const contextEntries = Object.entries(logRecord.context)
  let widestKey = 0
  let first = true

  const contextEntriesRendered = contextEntries.map(([key, value]) => {
    // Track context space consumption of entry separators
    if (!first)
      contextColumnsConsumed += separators.contextEntry.singleLine.length
    else first = false

    // Track widest key optimistically for use in multiline layout later
    if (key.length > widestKey) widestKey = key.length

    contextColumnsConsumed +=
      key.length + separators.contextKeyVal.singleLine.symbol.length

    const valueRendered = `${util.inspect(value, {
      breakLength: availableSinglelineContextColumns,
      colors: true,
      getters: true,
      depth: 20,
    })}`

    contextColumnsConsumed += stripAnsi(valueRendered).length

    return [key, valueRendered]
  })

  const contextFitsSingleLine =
    contextColumnsConsumed <= availableSinglelineContextColumns

  let contextRendered = ''
  if (contextEntries.length > 0) {
    if (contextFitsSingleLine) {
      contextRendered =
        renderEl(separators.context.singleLine) +
        contextEntriesRendered
          .map(
            ([key, value]) =>
              `${chalk.gray(key)}${renderEl(
                separators.contextKeyVal.singleLine
              )}${value}`
          )
          .join(separators.contextEntry.singleLine)
    } else {
      const spineRendered = renderEl(
        separators.contextEntry.multiline(utils.spanSpace(gutterWidth))
      )
      contextRendered =
        renderEl(separators.context.multiline) +
        '\n' +
        spineRendered +
        contextEntriesRendered
          .map(
            ([key, value]) =>
              `${chalk.gray(utils.clampSpace(widestKey, key))}${renderEl(
                separators.contextKeyVal.multiline
              )}${formatBlock(value, {
                leftSpineSymbol: spineRendered,
                excludeFirstLine: true,
                indent:
                  widestKey + separators.contextKeyVal.multiline.symbol.length,
              })}`
          )
          .join('\n' + spineRendered)
    }
  }

  //
  // put it together
  //

  return `${gutterRendered}${preContextRendered}${contextRendered}\n`
}

type El = {
  symbol: string
  color?: Chalk
}

function renderEl(el: El) {
  return el.color ? el.color(el.symbol) : el.symbol
}

/**
 * Given a multiline string, run a single pass over each line carrying out the
 * given transformations configured in given options.
 *
 * If singleline given, returned as-is.
 */
function formatBlock(
  block: string,
  opts: {
    indent?: number
    excludeFirstLine?: boolean
    leftSpineSymbol?: string | El
  }
): string {
  const [first, ...rest] = block.split('\n')
  if (rest.length === 0) return first
  const linesToProcess =
    opts.excludeFirstLine === true ? rest : (rest.unshift(first), rest)
  const prefix =
    typeof opts.leftSpineSymbol === 'string'
      ? opts.leftSpineSymbol
      : opts.leftSpineSymbol?.symbol ?? ''
  const indent = opts.indent !== undefined ? utils.spanSpace(opts.indent) : ''
  const linesProcessed = opts.excludeFirstLine === true ? [first] : []
  for (const line of linesToProcess) {
    const prefixRendered =
      typeof opts.leftSpineSymbol === 'object'
        ? opts.leftSpineSymbol?.color?.(prefix) ?? prefix
        : prefix
    linesProcessed.push(prefixRendered + indent + line)
  }
  return linesProcessed.join('\n')
}

/**
 * Create a stop watch. Makes it simple to calculate elapsed time on every
 * invocation of `lap`.
 */
function createStopWatch() {
  let prev = Date.now()
  return {
    lap(): number {
      const curr = Date.now()
      const elapsed = curr - prev
      prev = curr
      return elapsed
    },
  }
}
