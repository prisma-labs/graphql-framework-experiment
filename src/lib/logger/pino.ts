import originalCreatePino, * as Pino from 'pino'
import * as Prettifier from './prettifier'
import * as Output from './output'
import { Level } from './level'

export { Logger } from 'pino'

/**
 * The pino typings are poor and, for example, do not account for prettifier or
 * mixin field. Also see note from Matteo about not using them:
 * https://github.com/graphql-nexus/nexus-future/pull/244#issuecomment-572573672
 */
type ActualPinoOptions = Pino.LoggerOptions & {
  prettifier: (opts: any) => (logRec: any) => string
}

type Options = {
  pretty: boolean
  level: Level
  output: Output.Output
}

/**
 * Helper to create pino instance. Aside from encapsulating some hardcoded
 * settings this is also useful because we call it from multiple places.
 * Currently when changing in/out of pretty mode and construction time.
 */
export function create(opts: Options): Pino.Logger {
  const pino = originalCreatePino(
    {
      prettyPrint: opts.pretty,
      prettifier: (_opts: any) => Prettifier.render,
      messageKey: 'event',
    } as ActualPinoOptions,
    opts.output
  )
  pino.level = opts.level
  return pino
}
