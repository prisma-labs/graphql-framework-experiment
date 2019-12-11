import { stripIndents, stripIndent } from 'common-tags'
import Arg from 'arg'
import * as Layout from '../../framework/layout'
import * as fs from 'fs-jetpack'
import { fatal } from '../../utils'
import * as Plugin from '../../framework/plugin'

/**
 * format
 */
export function format(input: string = ''): string {
  return stripIndents(input).trimRight() + '\n'
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
