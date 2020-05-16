import * as Layout from '../layout'
import { rootLogger } from '../nexus-logger'
import { fatal } from '../process'
import * as Reflection from '../reflection/reflect'
import { Plugin } from './types'

const log = rootLogger.child('plugin')

/**
 * This gets all the plugins in use in the app.
 *
 * @remarks
 *
 * This is useful for the CLI to get worktime plugins. This will run the app in
 * reflection **in this process**.
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
    fatal('Failed to scan app for used plugins because there is a runtime error in the app', {
      error: e,
    })
  }
}
