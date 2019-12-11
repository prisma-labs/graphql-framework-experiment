import { stripIndents } from 'common-tags'
import Arg from 'arg'
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

// HACK WIP
// TODO

// import * as PrismaPlugin from 'pumpkins-plugin-prisma'

/**
 * Load used plugins
 */
export async function loadPlugins(): Promise<Plugin.WorkflowContributions[]> {
  // return [PrismaPlugin.createPrismaPlugin().workflow!]
  return []
}
