import * as Path from 'path'
import { createE2EContext } from '../../src/lib/e2e-testing'
import { e2eKitchenSink } from '../__helpers/e2e'

const ctx = createE2EContext({
  serverPort: 5001,
  localNexus: {
    path: Path.join(__dirname, '..', '..'),
    createAppWithThis: true,
    createPluginWithThis: true,
    pluginLinksToThis: true,
  },
})

test('kitchen sink', async () => {
  await e2eKitchenSink(ctx)
})
