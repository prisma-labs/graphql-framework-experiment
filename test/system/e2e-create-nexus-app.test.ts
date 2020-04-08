import * as path from 'path'
import { createE2EContext } from '../../src/lib/e2e-testing'
import { e2ePrismaApp } from '../__helpers/e2e'

const ctx = createE2EContext({
  localNexus: {
    path: path.join(__dirname, '..', '..'),
    createAppWithThis: true,
    createPluginWithThis: true,
    pluginLinksToThis: true,
  },
})

test('e2e', async () => {
  await e2ePrismaApp(ctx)
})
