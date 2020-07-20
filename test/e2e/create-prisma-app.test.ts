import { createE2EContext } from '../../src/lib/e2e-testing'
import { e2ePrismaApp } from '../__helpers/e2e'

const ctx = createE2EContext({ localNexus: null, serverPort: 4002 })

test('create prisma app', async () => {
  await e2ePrismaApp(ctx)
})
