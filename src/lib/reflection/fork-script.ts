import type * as App from '../../runtime/app'
import { createDevAppRunner } from '../../runtime/start'
import * as Layout from '../layout'
import { writeTypegen } from './typegen'
import type { Message } from './reflect'
import * as Plugin from '../plugin'
import { setReflectionStage } from './stage'
import { serializeError } from 'serialize-error'

async function run() {
  if (!process.env.NEXUS_REFLECTION_LAYOUT) {
    throw new Error('process.env.NEXUS_REFLECTION_LAYOUT is required')
  }

  /**
   * Set the NEXUS_REFLECTION environment variable so that the server doesn't run
   */
  setReflectionStage()

  const app = require('nexus').default as App.InternalApp
  const layout = Layout.createFromData(JSON.parse(process.env.NEXUS_REFLECTION_LAYOUT) as Layout.Data)
  const appRunner = createDevAppRunner(layout, app, {
    catchUnhandledErrors: false,
  })

  try {
    await appRunner.start()
  } catch (err) {
    sendErrorToParent(err)
  }

  const plugins = app.__state.plugins()
  const graphqlSchema = app.__state.schema()

  if (process.env.NEXUS_SHOULD_GENERATE_ARTIFACTS) {
    try {
      await writeTypegen({
        graphqlSchema,
        layout,
        schemaSettings: app.settings.current.schema,
        plugins: Plugin.importAndLoadRuntimePlugins(plugins),
      })
    } catch (err) {
      sendErrorToParent(err)
    }
  }

  sendDataToParent({
    type: 'success',
    data: {
      plugins,
    },
  })

  function sendDataToParent(message: Message) {
    if (!process.send) {
      throw new Error('process.send is undefined, could not send the plugins back to the main process')
    }

    process.send(message)
  }

  function sendErrorToParent(err: Error) {
    sendDataToParent({ type: 'error', data: { serializedError: serializeError(err) } })
  }
}

run()
