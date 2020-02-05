import * as app from '../framework'
import { rootLogger } from '../utils/logger'
import { App } from './app'

const experimentsLogger = rootLogger.child('experiments')

type Components = keyof App['settings']['current']

export function markAsExperimental<F extends (...args: any[]) => any>(
  component: Components,
  experimentName: string,
  f: F
): F {
  return function(...args: any[]) {
    if ((app.settings.current as any)[component][experimentName]) {
      return f(...args)
    } else {
      if (process.env.NEXUS_STAGE !== 'dev') {
        throw new Error('...')
      } else {
        experimentsLogger.warn(
          `${component}.${name} is an experimental API. You are not allowed to use it until you explicitly opt-in. If you do not then your app will be force-exited in production. Please either stop using this API or opt-in. To opt-in add this to your settings:\n\n{ "experiments": { "${name}": true } }`,
          { component, experiment: name }
        )
        f(...args)
      }
    }
  } as any
}
