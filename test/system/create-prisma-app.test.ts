import * as Path from 'path'
import { createE2EContext } from '../../src/lib/e2e-testing'
import { e2ePrismaApp } from '../__helpers/e2e'

const ctx = createE2EContext({
  serverPort: 5002,
  localNexus: {
    path: Path.join(__dirname, '..', '..'),
    createAppWithThis: true,
    createPluginWithThis: true,
    pluginLinksToThis: true,
  },
})

test('create prisma app', async () => {
  await e2ePrismaApp(ctx)
})
