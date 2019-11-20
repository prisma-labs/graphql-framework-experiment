import * as util from 'util'
import fmt from 'dateformat'
import Debug from 'debug'

const debug = Debug('ts-node-dev:app')

const colors = {
  info: '36',
  error: '31;1',
  warn: '33',
  debug: '90',
}

/**
 * Logs a message to the console. The level is displayed in ANSI colors,
 * either bright red in case of an error or green otherwise.
 */
export default function(cfg: any) {
  function log(msg: any, level: any) {
    if (cfg.timestamp) msg = color(fmt(cfg.timestamp), '30;1') + ' ' + msg
    const c = (colors as any)[level.toLowerCase()] || '32'
    console.log('[' + color(level.toUpperCase(), c) + '] ' + msg)
  }

  function color(s: string, c: string) {
    if (process.stdout.isTTY) {
      return '\x1B[' + c + 'm' + s + '\x1B[0m'
    }
    return s
  }

  log.debug = function(...args: any[]) {
    if (!cfg.debug) return
    debug(args.join(' '))
  }

  log.info = function(...args: any[]) {
    log(args.join(' '), 'info')
  }

  log.warn = function(...args: any[]) {
    log(args.join(' '), 'warn')
  }

  log.error = function(...args: any[]) {
    log(args.join(' '), 'error')
  }

  return log
}
