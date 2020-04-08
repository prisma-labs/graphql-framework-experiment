import * as path from 'path'
import { createE2EContext } from '../../src/lib/e2e-testing'
import { e2eKitchenSink } from '../__helpers/e2e/kitchen-sink'

const ctx = createE2EContext({
  localNexus: {
    path: path.join(__dirname, '..', '..'),
    createAppWithThis: true,
    createPluginWithThis: true,
    pluginLinksToThis: true,
  },
})

test('cli entrypoint create app', async () => {
  await e2eKitchenSink(ctx)
})
