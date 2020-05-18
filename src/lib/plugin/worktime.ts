import { Plugin } from './types'
import * as Layout from '../layout'
import * as Reflection from '../reflection/reflect'
import * as Process from '../process'
import { rootLogger } from '../nexus-logger'

const log = rootLogger.child('plugin')

/**
 * This gets all the plugins in use in the app.
 *
 * @remarks
 *
 * This is useful for the CLI to get worktime plugins. This will run the app in
 * data mode, in this process.
 */
export async function getUsedPlugins(layout: Layout.Layout): Promise<Plugin[]> {
  try {
    const reflection = await Reflection.reflect(layout, { usedPlugins: true, onMainThread: true })

    if (!reflection.success) {
      throw reflection.error
    }

    log.trace('got used plugins', { validPlugins: reflection.plugins })

    return reflection.plugins
  } catch (e) {
    Process.fatal('Failed to scan app for used plugins because there is a runtime error in the app', {
      error: e,
    })
  }
}
