import { isLeft } from 'fp-ts/lib/Either'
import type * as App from '../../runtime/app'
import { createDevAppRunner } from '../../runtime/start'
import * as Layout from '../layout'
import * as Plugin from '../plugin'
import { serializeError } from '../utils'
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
    sendErrorToParent(err, 'runtime-error')
  }

  if (isReflectionStage('typegen')) {
    try {
      const plugins = Plugin.importAndLoadRuntimePlugins(
        app.private.state.plugins,
        app.private.state.components.schema.scalars
      )
      const artifactsRes = await writeArtifacts({
        graphqlSchema: app.private.state.assembled!.schema,
        layout,
        schemaSettings: app.settings.current.schema,
        plugins,
      })
      if (isLeft(artifactsRes)) {
        sendErrorToParent(artifactsRes.left, 'ts-error')
      } else {
        sendDataToParent({
          type: 'success-typegen',
        })
      }

      return
    } catch (err) {
      sendErrorToParent(err, 'runtime-error')
    }
  }

  function sendDataToParent(message: Message) {
    if (!process.send) {
      throw new Error('process.send is undefined, could not send the plugins back to the main process')
    }

    process.send(message)
  }

  function sendErrorToParent(err: Error, type: 'ts-error' | 'runtime-error') {
    sendDataToParent({ type, data: { serializedError: serializeError(err) } })
  }
}

run()
