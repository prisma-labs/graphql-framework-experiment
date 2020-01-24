export type Level = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace'

export type LevelNum = 60 | 50 | 40 | 30 | 20 | 10

export const LEVELS: Record<Level, { label: Level; number: LevelNum }> = {
  fatal: {
    label: 'fatal',
    number: 60,
  },
  error: {
    label: 'error',
    number: 50,
  },
  warn: {
    label: 'warn',
    number: 40,
  },
  info: {
    label: 'info',
    number: 30,
  },
  debug: {
    label: 'debug',
    number: 20,
  },
  trace: {
    label: 'trace',
    number: 10,
  },
}

export const LEVELS_BY_NUM = Object.values(LEVELS).reduce(
  (lookup, entry) => Object.assign(lookup, { [entry.number]: entry }),
  {}
) as Record<LevelNum, { label: Level; number: LevelNum }>

/**
 * Parser for log level. The given value is treated case insensitive.
 */
export const parser = {
  info: {
    typeName: 'LogLevel',
    valid: Object.entries(LEVELS)
      .map(([label]) => label)
      .join(', '),
  },
  run: (raw: string) => {
    return (LEVELS as any)[raw.toLowerCase()]?.label ?? null
  },
}
