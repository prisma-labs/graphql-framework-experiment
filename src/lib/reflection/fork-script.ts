import { serializeError } from 'serialize-error'
import type * as App from '../../runtime/app'
import { createDevAppRunner } from '../../runtime/start'
import * as Layout from '../layout'
import * as Plugin from '../plugin'
import type { Message } from './reflect'
import { isReflectionStage } from './stage'
import { writeArtifacts } from './typegen'

async function run() {
  if (!process.env.NEXUS_REFLECTION_LAYOUT) {
    throw new Error('process.env.NEXUS_REFLECTION_LAYOUT is required')
  }

  const app = require('../../').default as App.PrivateApp
  const layout = Layout.createFromData(JSON.parse(process.env.NEXUS_REFLECTION_LAYOUT) as Layout.Data)
  const appRunner = createDevAppRunner(layout, app, {
    catchUnhandledErrors: false,
  })

  try {
    await appRunner.start()
  } catch (err) {
    sendErrorToParent(err)
  }

  if (isReflectionStage('typegen')) {
    try {
      const plugins = await Plugin.importAndLoadRuntimePlugins(app.private.state.plugins)
      await writeArtifacts({
        graphqlSchema: app.private.state.assembled!.schema,
        layout,
        schemaSettings: app.settings.current.schema,
        plugins,
      })
      sendDataToParent({
        type: 'success-typegen',
      })

      return
    } catch (err) {
      sendErrorToParent(err)
    }
  }

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
