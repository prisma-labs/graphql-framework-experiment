import * as Lo from 'lodash'
import originalCreatePino, * as Pino from 'pino'
import stripAnsi from 'strip-ansi'
import { Level } from './level'
import * as Output from './output'
import * as Prettifier from './prettifier'

export { Logger } from 'pino'

/**
 * The pino typings are poor and, for example, do not account for prettifier or
 * mixin field. Also see note from Matteo about not using them:
 * https://github.com/graphql-nexus/nexus/pull/244#issuecomment-572573672
 */
type ActualPinoOptions = Pino.LoggerOptions & {
  prettifier: (opts: any) => (logRec: any) => string
}

type Options = {
  pretty: {
    enabled: boolean
    color: boolean
    levelLabel: boolean
    timeDiff: boolean
  }
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
      prettyPrint: opts.pretty.enabled,
      prettifier: (_opts: any) =>
        opts.pretty.color
          ? Prettifier.create(opts.pretty)
          : // todo more performant way to do this would be give task to de-colour
            // to render function. Then it can just use some cheap if conditions.
            // Presumably strip-ansi is doing WAY more work as it has to
            // traverse EVERY string logged...
            Lo.flow(Prettifier.create(opts.pretty), stripAnsi),
      messageKey: 'event',
    } as ActualPinoOptions,
    opts.output
  )
  pino.level = opts.level
  return pino
}
