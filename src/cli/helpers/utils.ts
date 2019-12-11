import { stripIndents } from 'common-tags'
import Arg from 'arg'
import * as Plugin from '../../framework/plugin'
import * as Layout from '../../framework/layout'

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

// HACK WIP

import createPrismaPlugin from 'pumpkins-plugin-prisma'

/**
 * Load used plugins
 */
export async function loadPlugins(
  layout: Layout.Layout
): Promise<Plugin.WorkflowContributions[]> {
  return [createPrismaPlugin(Plugin.createController(layout)).workflow!]
}
